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
        let mut inner = self.inner.lock().map_err(|e| e.to_string())?;
        if inner.src.is_empty() {
            return Ok(());
        }
        // Already have a stream: just resume.
        if inner.stream.is_some() {
            inner.playing = true;
            return Ok(());
        }
        let host = cpal::default_host();
        let device = host.default_output_device().ok_or("no output device")?;
        let supported = device.default_output_config().map_err(|e| e.to_string())?;
        let out_channels = supported.channels() as usize;
        let out_rate = supported.sample_rate();
        inner.out_channels = out_channels;
        inner.out_rate = out_rate;

        let inner_clone = Arc::clone(&self.inner);
        let stream = device
            .build_output_stream(
                supported.config(),
                move |data: &mut [f32], _| {
                    let mut inner = match inner_clone.lock() {
                        Ok(g) => g,
                        Err(_) => return,
                    };
                    if !inner.playing {
                        for s in data.iter_mut() {
                            *s = 0.0;
                        }
                        return;
                    }
                    let src_ch = inner.src_channels;
                    let src_rate = inner.src_rate as f64;
                    let out_rate = inner.out_rate as f64;
                    let ratio = src_rate / out_rate;
                    let total_src_frames = inner.src.len() / src_ch;
                    let total_src_frames_f = total_src_frames as f64;
                    // Cursor is a fractional source-frame position. Each output
                    // frame consumes `ratio` source frames; we index into the
                    // source with the truncated integer position.
                    let mut pos = inner.cursor;
                    let out_ch = inner.out_channels;
                    for frame in data.chunks_mut(out_ch) {
                        if pos >= total_src_frames_f {
                            inner.playing = false;
                            for s in frame.iter_mut() {
                                *s = 0.0;
                            }
                            pos = total_src_frames_f;
                            break;
                        }
                        let src_frame = pos as usize;
                        // Downmix/upmix source frame to output channels.
                        for (ci, sample) in frame.iter_mut().enumerate() {
                            let src_ci = if src_ch == 1 { 0 } else { ci % src_ch };
                            let idx = src_frame * src_ch + src_ci;
                            let val = if idx < inner.src.len() {
                                inner.src[idx]
                            } else {
                                0.0
                            };
                            *sample = val * inner.volume;
                        }
                        pos += ratio;
                    }
                    inner.cursor = pos.min(total_src_frames_f);
                },
                |err| {
                    log::error!("audio stream error: {}", err);
                },
                None,
            )
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
        let total = (inner.src.len() / inner.src_channels.max(1)) as f64;
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
