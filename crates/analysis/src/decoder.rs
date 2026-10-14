//! Audio file decoding using Symphonia 0.6.
//!
//! Provides multi-format decoding (MP3, WAV, FLAC, AIFF, AAC/M4A) into normalized
//! interleaved 32-bit floating point PCM audio buffers.

use std::fs::File;
use std::path::{Path, PathBuf};

use symphonia::core::codecs::audio::AudioDecoderOptions;
use symphonia::core::codecs::CodecParameters;
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::probe::Hint;
use symphonia::core::formats::{FormatOptions, TrackType};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;

use crate::error::AudioDecodeError;

/// Decoded audio buffer containing normalized 32-bit float samples.
#[derive(Debug, Clone, PartialEq)]
pub struct DecodedAudio {
    /// Sample rate in Hertz (e.g. 44100, 48000).
    pub sample_rate: u32,
    /// Number of audio channels (e.g. 1 for mono, 2 for stereo).
    pub channels: usize,
    /// Duration in seconds.
    pub duration_seconds: f64,
    /// Interleaved audio samples in the range `[-1.0, 1.0]`.
    pub samples: Vec<f32>,
}

impl DecodedAudio {
    /// Total number of sample frames (samples / channels).
    pub fn total_frames(&self) -> usize {
        self.samples.len().checked_div(self.channels).unwrap_or(0)
    }

    /// Converts interleaved samples to a single mono channel by averaging channels.
    pub fn to_mono(&self) -> Vec<f32> {
        if self.channels <= 1 {
            return self.samples.clone();
        }

        let num_frames = self.total_frames();
        let mut mono = Vec::with_capacity(num_frames);
        let ch_f32 = self.channels as f32;

        for frame in self.samples.chunks_exact(self.channels) {
            let sum: f32 = frame.iter().sum();
            mono.push(sum / ch_f32);
        }

        mono
    }

    /// Separates interleaved audio into individual channel buffers (planar layout).
    pub fn channel_planar(&self) -> Vec<Vec<f32>> {
        if self.channels <= 1 {
            return vec![self.samples.clone()];
        }

        let num_frames = self.total_frames();
        let mut channels = vec![Vec::with_capacity(num_frames); self.channels];

        for frame in self.samples.chunks_exact(self.channels) {
            for (ch_idx, &sample) in frame.iter().enumerate() {
                channels[ch_idx].push(sample);
            }
        }

        channels
    }
}

/// Decodes an audio file at the specified path into normalized 32-bit floating point PCM.
pub fn decode_audio_file<P: AsRef<Path>>(path: P) -> Result<DecodedAudio, AudioDecodeError> {
    let path_ref = path.as_ref();
    let file = File::open(path_ref).map_err(|e| AudioDecodeError::Io {
        path: path_ref.to_path_buf(),
        source: e,
    })?;

    decode_from_source(
        Box::new(file),
        path_ref.to_path_buf(),
        path_ref.extension().and_then(|s| s.to_str()),
    )
}

fn decode_from_source(
    source: Box<dyn symphonia::core::io::MediaSource>,
    path_for_err: PathBuf,
    extension_hint: Option<&str>,
) -> Result<DecodedAudio, AudioDecodeError> {
    let mss = MediaSourceStream::new(source, Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = extension_hint {
        hint.with_extension(ext);
    }

    let mut format = symphonia::default::get_probe()
        .probe(
            &hint,
            mss,
            FormatOptions::default(),
            MetadataOptions::default(),
        )
        .map_err(|_| AudioDecodeError::UnrecognizedFormat {
            path: path_for_err.clone(),
        })?;

    let track = format
        .default_track(TrackType::Audio)
        .or_else(|| format.first_track_known_codec(TrackType::Audio))
        .ok_or_else(|| AudioDecodeError::NoAudioTrack {
            path: path_for_err.clone(),
        })?;

    let track_id = track.id;

    let audio_params = match &track.codec_params {
        Some(CodecParameters::Audio(params)) => params,
        _ => {
            return Err(AudioDecodeError::UnsupportedCodec(
                "Track does not contain audio parameters".into(),
            ));
        }
    };

    let sample_rate = audio_params
        .sample_rate
        .ok_or_else(|| AudioDecodeError::UnsupportedCodec("Missing sample rate".into()))?;

    let channels = audio_params
        .channels
        .as_ref()
        .map(|c| c.count())
        .ok_or_else(|| AudioDecodeError::UnsupportedCodec("Missing channel count".into()))?;

    let decoder_opts = AudioDecoderOptions::default();
    let mut decoder = symphonia::default::get_codecs()
        .make_audio_decoder(audio_params, &decoder_opts)
        .map_err(|e| AudioDecodeError::Symphonia {
            path: path_for_err.clone(),
            message: e.to_string(),
        })?;

    let mut all_samples: Vec<f32> = Vec::new();

    loop {
        let packet_opt = match format.next_packet() {
            Ok(opt) => opt,
            Err(SymphoniaError::IoError(e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof
                    || e.kind() == std::io::ErrorKind::WouldBlock =>
            {
                break;
            }
            Err(SymphoniaError::IoError(_)) => break,
            Err(SymphoniaError::DecodeError(_)) => continue, // Skip corrupt packet
            Err(e) => {
                return Err(AudioDecodeError::Symphonia {
                    path: path_for_err,
                    message: e.to_string(),
                });
            }
        };

        let packet = match packet_opt {
            Some(p) => p,
            None => break, // Clean EOF
        };

        if packet.track_id != track_id {
            continue;
        }

        match decoder.decode(&packet) {
            Ok(decoded) => {
                let n_samples = channels.max(1) * decoded.frames();
                let start = all_samples.len();
                all_samples.resize(start + n_samples, 0.0);
                decoded.copy_to_slice_interleaved(&mut all_samples[start..]);
            }
            Err(SymphoniaError::DecodeError(_)) => {
                // Gracefully ignore corrupt frames within an otherwise valid stream
                continue;
            }
            Err(SymphoniaError::IoError(_)) => break,
            Err(e) => {
                return Err(AudioDecodeError::Symphonia {
                    path: path_for_err,
                    message: e.to_string(),
                });
            }
        }
    }

    if all_samples.is_empty() {
        return Err(AudioDecodeError::EmptyStream);
    }

    let frames = all_samples.len() / channels.max(1);
    let duration_seconds = frames as f64 / sample_rate as f64;

    Ok(DecodedAudio {
        sample_rate,
        channels,
        duration_seconds,
        samples: all_samples,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn get_fixture(rel: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .parent()
            .unwrap()
            .join("fixtures")
            .join("audio")
            .join(rel)
    }

    #[test]
    fn decodes_wav_fixture() {
        let path = get_fixture("wav/no-tags.wav");
        let decoded = decode_audio_file(&path).expect("Should decode wav fixture");

        assert!(decoded.sample_rate > 0);
        assert!(decoded.channels >= 1);
        assert!(!decoded.samples.is_empty());
        assert!(decoded.duration_seconds > 0.0);

        let mono = decoded.to_mono();
        assert_eq!(mono.len(), decoded.total_frames());
    }

    #[test]
    fn decodes_flac_fixture() {
        let path = get_fixture("flac/tagged-techno-140.flac");
        let decoded = decode_audio_file(&path).expect("Should decode flac fixture");

        assert_eq!(decoded.sample_rate, 44100);
        assert_eq!(decoded.channels, 2);
        assert!(!decoded.samples.is_empty());
    }

    #[test]
    fn decodes_mp3_fixture() {
        let path = get_fixture("mp3/tagged-mp3-125.mp3");
        let decoded = decode_audio_file(&path).expect("Should decode mp3 fixture");

        assert!(decoded.sample_rate > 0);
        assert!(!decoded.samples.is_empty());
    }

    #[test]
    fn decodes_m4a_fixture() {
        let path = get_fixture("m4a/tagged-m4a-128.m4a");
        let decoded = decode_audio_file(&path).expect("Should decode m4a fixture");

        assert!(decoded.sample_rate > 0);
        assert!(!decoded.samples.is_empty());
    }

    #[test]
    fn non_existent_file_returns_io_error() {
        let path = PathBuf::from("does_not_exist.wav");
        let res = decode_audio_file(&path);
        assert!(matches!(res, Err(AudioDecodeError::Io { .. })));
    }
}
