//! Error definitions for audio decoding, normalization, and ONNX Runtime inference.

use std::path::PathBuf;
use thiserror::Error;

/// Errors that can occur during audio file decoding.
#[derive(Debug, Error)]
pub enum AudioDecodeError {
    #[error("I/O error while reading audio file at '{path}': {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    #[error("Symphonia error while decoding '{path}': {message}")]
    Symphonia { path: PathBuf, message: String },

    #[error("No supported audio track found in '{path}'")]
    NoAudioTrack { path: PathBuf },

    #[error("Audio format not recognized for file at '{path}'")]
    UnrecognizedFormat { path: PathBuf },

    #[error("Unsupported audio codec or parameter: {0}")]
    UnsupportedCodec(String),

    #[error("Empty or zero-length audio stream")]
    EmptyStream,
}

/// Errors that can occur during audio normalization and DSP.
#[derive(Debug, Error)]
pub enum NormalizationError {
    #[error("Invalid channel count: {0} (must be >= 1)")]
    InvalidChannels(usize),

    #[error("Invalid sample rate: source={source_rate} Hz, target={target_rate} Hz (must be > 0)")]
    InvalidSampleRate { source_rate: u32, target_rate: u32 },

    #[error("Empty audio sample buffer cannot be normalized")]
    EmptyBuffer,

    #[error("Target peak must be positive and finite, got {0}")]
    InvalidTargetPeak(f32),

    #[error("Target RMS must be positive and finite, got {0}")]
    InvalidTargetRms(f32),
}

/// Errors that can occur during model checksum verification.
#[derive(Debug, Error, PartialEq, Eq)]
pub enum ChecksumError {
    #[error("SHA-256 checksum mismatch for '{path}': expected {expected}, calculated {actual}")]
    FileMismatch {
        path: PathBuf,
        expected: String,
        actual: String,
    },

    #[error("SHA-256 checksum mismatch: expected {expected}, calculated {actual}")]
    BytesMismatch { expected: String, actual: String },

    #[error("Failed to read file for checksum verification at '{path}': {message}")]
    Io { path: PathBuf, message: String },
}

/// Errors that can occur during higher-level audio analysis (e.g. BPM / beat-grid
/// estimation). These represent hard failures; transient inability to find a
/// tempo is represented as a low-confidence [`crate::bpm::BeatGrid`] instead.
#[derive(Debug, Error)]
pub enum AnalysisError {
    #[error("empty audio samples; cannot analyze")]
    EmptyAudio,

    #[error("sample rate {0} Hz is unsupported for analysis")]
    UnsupportedSampleRate(u32),

    #[error("EBU R128 loudness measurement failed: {0}")]
    Loudness(String),

    #[error("normalization error: {0}")]
    Normalization(#[from] NormalizationError),
}

/// Errors that can occur during ONNX Runtime initialization, loading, or execution.
#[derive(Debug, Error)]
pub enum OnnxError {
    #[error(
        "ONNX Runtime dynamic library not found. Set ORT_DYLIB_PATH or install ONNX Runtime: {0}"
    )]
    DylibNotFound(String),

    #[error("Invalid model path '{filename}': {reason}")]
    InvalidModelPath { filename: String, reason: String },

    #[error("Checksum verification failed for model: {0}")]
    Checksum(#[from] ChecksumError),

    #[error("Failed to initialize ONNX Runtime: {0}")]
    InitFailed(String),

    #[error("Failed to load ONNX model from '{path}': {message}")]
    ModelLoadFailed { path: PathBuf, message: String },

    #[error("Failed to load ONNX model from bytes: {0}")]
    ModelBytesLoadFailed(String),

    #[error("Inference execution error: {0}")]
    InferenceFailed(String),

    #[error("I/O error while reading model file '{path}': {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
}
