//! `dj-assistant-analysis`
//!
//! Audio analysis engine for DJ Assistant:
//! - Multi-format audio decoding via Symphonia (MP3, WAV, FLAC, AIFF, M4A/AAC).
//! - DSP normalization: downmixing, channel extraction, linear resampling, peak & RMS normalization.
//! - ONNX Runtime (`ort`) inference engine: dynamic loading, checksum verification (SHA-256), and session runner.

pub mod bpm;
pub mod checksum;
pub mod decoder;
pub mod error;
pub mod key;
pub mod normalizer;
pub mod onnx;
pub mod phrase;
pub mod registry;
pub mod vocal;

// Re-exports for convenience
pub use bpm::{detect_beat_grid, BeatGrid, BpmMethod, BpmOptions, PIPELINE_VERSION};
pub use checksum::{compute_sha256, verify_checksum, verify_file_checksum};
pub use decoder::{decode_audio_file, DecodedAudio};
pub use error::{AnalysisError, AudioDecodeError, ChecksumError, NormalizationError, OnnxError};
pub use key::{detect_key, KeyEstimate, KeyMethod, KeyOptions, KEY_PIPELINE_VERSION};
pub use normalizer::{
    peak_normalize, prepare_for_model, resample, rms_normalize, to_mono, to_stereo,
};
pub use onnx::{
    find_onnxruntime_dylib, init_onnx_runtime, load_model_session, load_session_from_bytes,
    load_session_from_file, run_smoke_test,
};
pub use phrase::{
    detect_phrases, Phrase, PhraseMap, PhraseMethod, PhraseOptions, SectionKind,
    PHRASE_PIPELINE_VERSION,
};
pub use registry::{
    discover_models_dir, resolve_model_path, ModelRegistry, ModelSpec, MODELS_DIR_ENV_VAR,
};
pub use vocal::{
    detect_vocal_presence, VocalMethod, VocalOptions, VocalPoint, VocalProfile,
    VOCAL_PIPELINE_VERSION,
};

/// Crate version string.
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
