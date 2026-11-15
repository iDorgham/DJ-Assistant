use std::sync::{Arc, Mutex};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use dj_assistant_analysis::decode_audio_file;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioState {
    pub playing: bool,
    pub position_ms: u64,
    pub duration_ms: u64,
    pub volume: f32,
}

struct Inner {
    // Source audio (interleaved f32, src channels, src sample rate).
    src: Vec<f32>,
    src_channels: usize,
    src_rate: u32,
    duration_ms: u64,
    /// Playback cursor, in **source** frames (fractional). Kept in
    /// source-frame units so `seek` (which computes source frames from ms)
    /// and `state` (which converts source frames back to ms) stay consistent
    /// regardless of the output device's sample rate. Fractional so that
    /// resampling (src_rate != out_rate) advances correctly instead of
    /// drifting or truncating.
    cursor: f64,
    playing: bool,
    volume: f32,
    // Output stream (kept alive).
    stream: Option<cpal::Stream>,
    out_rate: u32,
    out_channels: usize,
    /// Set by the stream's error callback when the device fails or is
    /// unplugged: the retained stream is dead and must be rebuilt, not resumed.
    stream_failed: bool,
}

pub struct AudioEngine {
    inner: Arc<Mutex<Inner>>,
}

impl AudioEngine {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(Inner {
                src: Vec::new(),
                src_channels: 2,
                src_rate: 44100,
                duration_ms: 0,
                cursor: 0.0,
                playing: false,
                volume: 0.8,
                stream: None,
                out_rate: 44100,
                out_channels: 2,
                stream_failed: false,
            })),
        }
    }

    pub fn load(&self, path: &str) -> Result<u64, String> {
        let decoded = decode_audio_file(path).map_err(|e| e.to_string())?;
        // Take the old stream out of the locked state before dropping it: cpal
        // stream teardown on Windows can block waiting for the audio callback
        // to drain, and we must not hold the engine mutex while that happens
        // (the callback itself acquires the same mutex).
        let stale_stream = {
            let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
            inner.playing = false;
            inner.stream_failed = false;
            inner.src = decoded.samples;
            inner.src_channels = decoded.channels.max(1);
            inner.src_rate = decoded.sample_rate;
            inner.duration_ms = (decoded.duration_seconds * 1000.0).round() as u64;
            inner.cursor = 0.0;
            inner.stream.take()
        };
        drop(stale_stream);
        Ok(self.state().duration_ms)
    }

    pub fn play(&self) -> Result<(), String> {
        // A failed stream is dropped outside the lock for the same reason as in
        // `load`: teardown can block until the audio callback drains.
        let failed_stream = {
            let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
            if inner.src.is_empty() {
                return Ok(());
            }
            // An exhausted cursor (the track reached its end) rewinds, so Play
            // starts the track again instead of stopping on the first frame.
            if inner.cursor >= total_frames(&inner) {
                inner.cursor = 0.0;
            }
            if inner.stream.is_some() && !inner.stream_failed {
                inner.playing = true;
                return Ok(());
            }
            inner.stream_failed = false;
            inner.stream.take()
        };
        drop(failed_stream);

        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        if inner.src.is_empty() {
            return Ok(());
        }
        // Another caller may have rebuilt the stream while the lock was open.
        if inner.stream.is_some() {
            inner.playing = true;
            return Ok(());
        }

        let host = cpal::default_host();
        let device = host.default_output_device().ok_or("no output device")?;
        let supported = device.default_output_config().map_err(|e| e.to_string())?;
        inner.out_channels = supported.channels() as usize;
        inner.out_rate = supported.sample_rate();

        // Build in the device's own sample format. Forcing an f32 callback makes
        // stream creation fail on devices whose default output is I16/U16.
        let config = supported.config();
        let stream = match supported.sample_format() {
            cpal::SampleFormat::F32 => {
                build_stream::<f32>(&device, config, Arc::clone(&self.inner))
            }
            cpal::SampleFormat::I16 => {
                build_stream::<i16>(&device, config, Arc::clone(&self.inner))
            }
            cpal::SampleFormat::U16 => {
                build_stream::<u16>(&device, config, Arc::clone(&self.inner))
            }
            other => return Err(format!("unsupported output sample format: {other:?}")),
        }
        .map_err(|e| e.to_string())?;
        stream.play().map_err(|e| e.to_string())?;
        inner.stream = Some(stream);
        inner.playing = true;
        Ok(())
    }

    pub fn pause(&self) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        inner.playing = false;
        Ok(())
    }

    pub fn seek(&self, ms: u64) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        let frames_per_ms = inner.src_rate as f64 / 1000.0;
        let target = ms as f64 * frames_per_ms;
        let total = total_frames(&inner);
        inner.cursor = target.min(total);
        Ok(())
    }

    pub fn set_volume(&self, v: f32) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        inner.volume = v.clamp(0.0, 1.0);
        Ok(())
    }

    pub fn state(&self) -> AudioState {
        let inner = self.inner.lock().unwrap();
        let pos_ms = if inner.src_rate > 0 {
            (inner.cursor / (inner.src_rate as f64 / 1000.0)) as u64
        } else {
            0
        };
        AudioState {
            playing: inner.playing,
            position_ms: pos_ms,
            duration_ms: inner.duration_ms,
            volume: inner.volume,
        }
    }
}

impl Default for AudioEngine {
    fn default() -> Self {
        Self::new()
    }
}

fn total_frames(inner: &Inner) -> f64 {
    (inner.src.len() / inner.src_channels.max(1)) as f64
}

/// Builds an output stream in the device's sample format, converting the mixed
/// f32 frames into that format on the way out.
fn build_stream<T>(
    device: &cpal::Device,
    config: cpal::StreamConfig,
    inner: Arc<Mutex<Inner>>,
) -> Result<cpal::Stream, cpal::Error>
where
    T: cpal::SizedSample + cpal::FromSample<f32>,
{
    let data_inner = Arc::clone(&inner);
    let error_inner = Arc::clone(&inner);
    let mut scratch: Vec<f32> = Vec::new();
    device.build_output_stream(
        config,
        move |data: &mut [T], _| {
            scratch.resize(data.len(), 0.0);
            fill_output(&mut scratch, &data_inner);
            for (out, sample) in data.iter_mut().zip(scratch.iter()) {
                *out = <T as cpal::FromSample<f32>>::from_sample_(*sample);
            }
        },
        move |err| {
            log::error!("audio stream error: {}", err);
            // Never block the audio/error thread on the engine mutex: if the
            // lock is held, the data callback notices the dead stream itself
            // and `play` rebuilds it on the next request.
            if let Ok(mut state) = error_inner.try_lock() {
                state.playing = false;
                state.stream_failed = true;
            }
        },
        None,
    )
}

/// Mixes the source into interleaved f32 output frames at the device's channel
/// count, resampling with a fractional source-frame cursor.
fn fill_output(data: &mut [f32], inner_arc: &Arc<Mutex<Inner>>) {
    let mut inner = match inner_arc.lock() {
        Ok(guard) => guard,
        Err(_) => {
            data.fill(0.0);
            return;
        }
    };
    if !inner.playing {
        data.fill(0.0);
        return;
    }

    let out_ch = inner.out_channels.max(1);
    let src_ch = inner.src_channels.max(1);
    let ratio = inner.src_rate as f64 / inner.out_rate.max(1) as f64;
    let total = total_frames(&inner);
    let volume = inner.volume;
    let mut pos = inner.cursor;

    for frame in data.chunks_mut(out_ch) {
        if pos >= total {
            frame.fill(0.0);
            inner.playing = false;
            pos = total;
            break;
        }
        let base = pos as usize * src_ch;
        if out_ch == 1 && src_ch > 1 {
            // A mono device gets the average of the source channels; taking
            // channel zero would drop the right channel entirely.
            let mut sum = 0.0f32;
            for channel in 0..src_ch {
                sum += inner.src.get(base + channel).copied().unwrap_or(0.0);
            }
            frame[0] = (sum / src_ch as f32) * volume;
        } else {
            for (index, sample) in frame.iter_mut().enumerate() {
                let src_index = if src_ch == 1 { 0 } else { index % src_ch };
                *sample = inner.src.get(base + src_index).copied().unwrap_or(0.0) * volume;
            }
        }
        pos += ratio;
    }
    inner.cursor = pos.min(total);
}
