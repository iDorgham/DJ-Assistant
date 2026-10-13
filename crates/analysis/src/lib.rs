//! `dj-assistant-analysis`
//!
//! Audio analysis engine for DJ Assistant:
//! - Multi-format audio decoding via Symphonia (MP3, WAV, FLAC, AIFF, M4A/AAC).
//! - DSP normalization: downmixing, channel extraction, linear resampling, peak & RMS normalization.
//! - ONNX Runtime (`ort`) inference engine: dynamic loading, checksum verification (SHA-256), and session runner.

pub mod checksum;
pub mod decoder;
pub mod error;
pub mod normalizer;
pub mod onnx;
pub mod registry;

// Re-exports for convenience
pub use checksum::{compute_sha256, verify_checksum, verify_file_checksum};
pub use decoder::{decode_audio_file, DecodedAudio};
pub use error::{AudioDecodeError, ChecksumError, NormalizationError, OnnxError};
pub use normalizer::{
    peak_normalize, prepare_for_model, resample, rms_normalize, to_mono, to_stereo,
};
pub use onnx::{
    find_onnxruntime_dylib, init_onnx_runtime, load_session_from_bytes, load_session_from_file,
    run_smoke_test,
};
pub use registry::{ModelRegistry, ModelSpec};

/// Crate version string.
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
