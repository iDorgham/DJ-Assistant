//! ONNX Runtime engine integration, dynamic library discovery, model loading, and smoke-testing.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use ort::session::Session;
use ort::value::Tensor;

use crate::checksum::{verify_checksum, verify_file_checksum};
use crate::error::OnnxError;
use crate::registry::{resolve_model_path, ModelSpec};

static ONNX_INITIALIZED: OnceLock<Result<(), String>> = OnceLock::new();

/// Searches for the ONNX Runtime dynamic library (`.dll`, `.so`, or `.dylib`) on the system.
///
/// Priority:
/// 1. `ORT_DYLIB_PATH` environment variable.
/// 2. Executable folder or current working directory.
/// 3. Platform-specific known installations (e.g. Edge WebView2 on Windows).
pub fn find_onnxruntime_dylib() -> Option<PathBuf> {
    // 1. Explicit environment override
    if let Ok(env_path) = std::env::var("ORT_DYLIB_PATH") {
        let path = PathBuf::from(env_path);
        if path.exists() {
            return Some(path);
        }
    }

    // 2. Relative to current exe or cwd
    let dylib_name = if cfg!(target_os = "windows") {
        "onnxruntime.dll"
    } else if cfg!(target_os = "macos") {
        "libonnxruntime.dylib"
    } else {
        "libonnxruntime.so"
    };

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let candidate = parent.join(dylib_name);
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    let cwd_candidate = PathBuf::from(dylib_name);
    if cwd_candidate.exists() {
        return Some(cwd_candidate);
    }

    // 3. Platform-specific known locations
    #[cfg(target_os = "windows")]
    {
        // Microsoft Edge WebView2 ships with an official AMD64 onnxruntime.dll
        let edge_pattern = "C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application";
        if let Ok(entries) = std::fs::read_dir(edge_pattern) {
            for entry in entries.flatten() {
                let candidate = entry.path().join("onnxruntime.dll");
                if candidate.exists() {
                    return Some(candidate);
                }
            }
        }

        // Additional common locations
        for known in [
            "C:\\Program Files\\Microsoft\\Edge\\Application\\onnxruntime.dll",
            "C:\\Program Files\\Plex\\Plex Media Server\\onnxruntime.dll",
        ] {
            let p = PathBuf::from(known);
            if p.exists() {
                return Some(p);
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        for candidate in [
            "/opt/homebrew/lib/libonnxruntime.dylib",
            "/usr/local/lib/libonnxruntime.dylib",
        ] {
            let p = PathBuf::from(candidate);
            if p.exists() {
                return Some(p);
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        for candidate in [
            "/usr/lib/libonnxruntime.so",
            "/usr/local/lib/libonnxruntime.so",
        ] {
            let p = PathBuf::from(candidate);
            if p.exists() {
                return Some(p);
            }
        }
    }

    None
}

/// Initializes the ONNX Runtime environment dynamically.
/// Safe to call multiple times; will only initialize once per process.
pub fn init_onnx_runtime() -> Result<(), OnnxError> {
    let res = ONNX_INITIALIZED.get_or_init(|| {
        let dylib_path = find_onnxruntime_dylib().ok_or_else(|| {
            "Could not locate onnxruntime library. Please set ORT_DYLIB_PATH or ensure ONNX Runtime is installed.".to_string()
        })?;

        ort::init_from(&dylib_path)
            .map_err(|e| format!("Failed to init ONNX Runtime from {}: {}", dylib_path.display(), e))?
            .commit();

        Ok(())
    });

    match res {
        Ok(()) => Ok(()),
        Err(err) => Err(OnnxError::DylibNotFound(err.clone())),
    }
}

/// Loads an ONNX session from raw model bytes, optionally verifying its SHA-256 checksum.
pub fn load_session_from_bytes(
    bytes: &[u8],
    expected_sha256: Option<&str>,
) -> Result<Session, OnnxError> {
    if let Some(expected) = expected_sha256 {
        verify_checksum(bytes, expected)?;
    }

    init_onnx_runtime()?;

    Session::builder()
        .map_err(|e| OnnxError::InitFailed(e.to_string()))?
        .commit_from_memory(bytes)
        .map_err(|e| OnnxError::ModelBytesLoadFailed(e.to_string()))
}

/// Loads an ONNX session from a model file path, optionally verifying its SHA-256 checksum.
pub fn load_session_from_file<P: AsRef<Path>>(
    path: P,
    expected_sha256: Option<&str>,
) -> Result<Session, OnnxError> {
    let path_ref = path.as_ref();

    if let Some(expected) = expected_sha256 {
        verify_file_checksum(path_ref, expected)?;
    }

    init_onnx_runtime()?;

    Session::builder()
        .map_err(|e| OnnxError::InitFailed(e.to_string()))?
        .commit_from_file(path_ref)
        .map_err(|e| OnnxError::ModelLoadFailed {
            path: path_ref.to_path_buf(),
            message: e.to_string(),
        })
}

/// Resolves a model spec's asset under `base_dir`, verifies its SHA-256 digest, and
/// loads it as an ONNX session. Path resolution runs before runtime initialization,
/// so an invalid spec filename fails fast even without ONNX Runtime installed.
pub fn load_model_session(
    base_dir: impl AsRef<Path>,
    spec: &ModelSpec,
) -> Result<Session, OnnxError> {
    let model_path = resolve_model_path(base_dir, spec)?;
    load_session_from_file(model_path, Some(&spec.sha256))
}

/// Executes the smoke-test model on a single float input and returns the model output.
/// The smoke-test model graph is `y = Relu(x)`; with a positive input this returns the
/// input unchanged. See `ModelSpec::smoke_test` for why `Relu` is used.
pub fn run_smoke_test(session: &mut Session, input_value: f32) -> Result<f32, OnnxError> {
    let tensor = Tensor::from_array(([1_usize], vec![input_value]))
        .map_err(|e| OnnxError::InferenceFailed(format!("Failed to build input tensor: {e}")))?;

    let outputs = session
        .run(ort::inputs![tensor])
        .map_err(|e| OnnxError::InferenceFailed(format!("Inference failed: {e}")))?;

    let output_val = outputs[0]
        .try_extract_scalar::<f32>()
        .map_err(|e| OnnxError::InferenceFailed(format!("Failed to extract scalar: {e}")))?;

    Ok(output_val)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::registry::ModelSpec;

    #[test]
    fn load_model_session_rejects_traversal_before_touching_the_runtime() {
        let spec = ModelSpec {
            filename: "../escape.onnx".to_string(),
            ..ModelSpec::smoke_test()
        };

        let res = load_model_session(Path::new("models"), &spec);

        assert!(
            matches!(res, Err(OnnxError::InvalidModelPath { .. })),
            "expected InvalidModelPath without runtime involvement, got {res:?}"
        );
    }

    #[test]
    fn load_model_session_resolves_and_loads_smoke_test_model() {
        let spec = ModelSpec::smoke_test();
        let base = spec
            .fixture_path()
            .parent()
            .expect("fixture path has a parent")
            .to_path_buf();
        assert!(
            base.join(&spec.filename).exists(),
            "smoke_test.onnx must exist"
        );

        if find_onnxruntime_dylib().is_none() {
            eprintln!(
                "skipping ONNX inference smoke test: no onnxruntime library found \
                 (set ORT_DYLIB_PATH to enable it)"
            );
            return;
        }

        let mut session =
            load_model_session(&base, &spec).expect("should resolve, verify, and load the model");

        let test_val = 42.5f32;
        let out = run_smoke_test(&mut session, test_val).expect("Should run smoke test inference");
        assert_eq!(out, test_val);
    }

    #[test]
    fn rejects_mismatched_model_checksum_before_touching_the_runtime() {
        let spec = ModelSpec::smoke_test();
        let path = spec.fixture_path();
        assert!(path.exists(), "smoke_test.onnx must exist");

        let bad_sha = "0000000000000000000000000000000000000000000000000000000000000000";
        let res = load_session_from_file(&path, Some(bad_sha));
        assert!(
            res.is_err(),
            "Must reject a model whose checksum does not match"
        );
    }

    #[test]
    fn loads_and_executes_smoke_test_model() {
        let spec = ModelSpec::smoke_test();
        let model_path = spec.fixture_path();
        assert!(model_path.exists(), "smoke_test.onnx must exist");

        // The ONNX Runtime is an external shared library. When it is not installed we
        // cannot execute inference, but the checksum/integrity path is still covered by
        // `smoke_test_fixture_matches_spec` and `rejects_mismatched_model_checksum_...`.
        if find_onnxruntime_dylib().is_none() {
            eprintln!(
                "skipping ONNX inference smoke test: no onnxruntime library found \
                 (set ORT_DYLIB_PATH to enable it)"
            );
            return;
        }

        // Load the model, verifying its pinned digest.
        let mut session = load_session_from_file(&model_path, Some(&spec.sha256))
            .expect("Should load smoke test session with verified checksum");

        // The smoke-test graph is `y = Relu(x)`; the positive input below passes through
        // unchanged, which proves the runtime executed the graph and returned its output.
        let test_val = 42.5f32;
        let out = run_smoke_test(&mut session, test_val).expect("Should run smoke test inference");
        assert_eq!(out, test_val);
    }
}
