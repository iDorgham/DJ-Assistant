//! SHA-256 checksum computation and verification for model assets.

use std::fs::File;
use std::io::Read;
use std::path::Path;

use sha2::{Digest, Sha256};

use crate::error::ChecksumError;

/// Computes the lowercase hexadecimal SHA-256 digest of the given bytes.
pub fn compute_sha256(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

/// Verifies that the in-memory bytes match the expected SHA-256 checksum (case-insensitive).
pub fn verify_checksum(data: &[u8], expected_sha256: &str) -> Result<(), ChecksumError> {
    let actual = compute_sha256(data);
    let expected = expected_sha256.trim().to_lowercase();

    if actual == expected {
        Ok(())
    } else {
        Err(ChecksumError::BytesMismatch { expected, actual })
    }
}

/// Verifies that the file at `path` matches the expected SHA-256 checksum (case-insensitive).
pub fn verify_file_checksum<P: AsRef<Path>>(
    path: P,
    expected_sha256: &str,
) -> Result<(), ChecksumError> {
    let path_ref = path.as_ref();
    let mut file = File::open(path_ref).map_err(|e| ChecksumError::Io {
        path: path_ref.to_path_buf(),
        message: e.to_string(),
    })?;

    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 16384];

    loop {
        let bytes_read = file.read(&mut buffer).map_err(|e| ChecksumError::Io {
            path: path_ref.to_path_buf(),
            message: e.to_string(),
        })?;

        if bytes_read == 0 {
            break;
        }

        hasher.update(&buffer[..bytes_read]);
    }

    let actual = format!("{:x}", hasher.finalize());
    let expected = expected_sha256.trim().to_lowercase();

    if actual == expected {
        Ok(())
    } else {
        Err(ChecksumError::FileMismatch {
            path: path_ref.to_path_buf(),
            expected,
            actual,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verifies_sha256_of_bytes() {
        let data = b"hello world";
        let expected = "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";

        assert_eq!(compute_sha256(data), expected);
        assert!(verify_checksum(data, expected).is_ok());
        assert!(verify_checksum(data, &expected.to_uppercase()).is_ok());

        let err = verify_checksum(
            data,
            "0000000000000000000000000000000000000000000000000000000000000000",
        );
        assert!(matches!(err, Err(ChecksumError::BytesMismatch { .. })));
    }
}
