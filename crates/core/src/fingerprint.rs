//! Fast, stable file fingerprinting for de-duplication.
//!
//! The fingerprint hashes the file's size together with its first 1 MiB. This is
//! deliberately *not* a full-content hash: it must be cheap enough to run over a
//! large library, and two genuinely different masters virtually never share both
//! a byte-identical first megabyte and an identical length.
//!
//! The trade-off is that a difference occurring only after the first 1 MiB, with
//! an identical file length, will not be detected as a difference. That is
//! acceptable for de-duplication (which only needs to avoid re-importing the same
//! file) but it means this value must not be used as a general integrity check.

use std::fs::File;
use std::io::{Error, Read};
use std::path::Path;

/// Number of leading bytes that participate in the fingerprint.
pub const FINGERPRINT_WINDOW: usize = 1024 * 1024;

/// Computes the fingerprint of the file at `path`.
///
/// Returns the BLAKE3 hash as a 64-character lowercase hex string. The hash is
/// stable across rescans and independent of filesystem metadata (timestamps,
/// permissions) — it depends only on file length and leading content.
pub fn compute_file_fingerprint<P: AsRef<Path>>(path: P) -> Result<String, Error> {
    let mut file = File::open(&path)?;
    let file_size = file.metadata()?.len();

    let mut hasher = blake3::Hasher::new();
    // Length first, so files that are prefixes of one another cannot collide.
    hasher.update(&file_size.to_le_bytes());

    let mut buffer = vec![0u8; FINGERPRINT_WINDOW];
    let bytes_read = file.read(&mut buffer)?;
    hasher.update(&buffer[..bytes_read]);

    Ok(hasher.finalize().to_hex().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn temp_file(name: &str, contents: &[u8]) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join("dj-assistant-fingerprint-tests");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(name);
        let mut f = File::create(&path).unwrap();
        f.write_all(contents).unwrap();
        f.sync_all().unwrap();
        path
    }

    #[test]
    fn fingerprint_is_stable_across_repeated_calls() {
        let path = temp_file(
            "stable.wav",
            b"RIFF....WAVEfmt ....data....AUDIO_SAMPLE_DATA",
        );
        let a = compute_file_fingerprint(&path).unwrap();
        let b = compute_file_fingerprint(&path).unwrap();

        assert_eq!(
            a, b,
            "rescanning the same file must yield the same fingerprint"
        );
        assert_eq!(a.len(), 64, "BLAKE3 hex digest is 64 chars");

        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn fingerprint_does_not_depend_on_mtime() {
        // Guards the "stable across rescans" requirement (SDD P0.3): rewriting a
        // file's timestamp must not change its fingerprint.
        let path = temp_file("mtime.wav", b"some audio payload");
        let before = compute_file_fingerprint(&path).unwrap();

        // Rewrite identical bytes.
        std::thread::sleep(std::time::Duration::from_millis(20));
        let mut f = File::create(&path).unwrap();
        f.write_all(b"some audio payload").unwrap();
        f.sync_all().unwrap();

        let after = compute_file_fingerprint(&path).unwrap();
        assert_eq!(before, after);

        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn different_content_yields_different_fingerprint() {
        let a = temp_file("a.wav", b"AAAAAAAAAA");
        let b = temp_file("b.wav", b"BBBBBBBBBB");

        assert_ne!(
            compute_file_fingerprint(&a).unwrap(),
            compute_file_fingerprint(&b).unwrap()
        );

        let _ = std::fs::remove_file(a);
        let _ = std::fs::remove_file(b);
    }

    #[test]
    fn file_length_participates_in_the_fingerprint() {
        // "HEADERDATA" is an exact prefix of "HEADERDATA-tail", and both fit inside
        // the read window. A content-only hash of the leading bytes cannot tell them
        // apart, so the explicit length component in the real fingerprint is what
        // prevents a truncated file from colliding with its full-length twin.
        let short = temp_file("short.wav", b"HEADERDATA");
        let long = temp_file("long.wav", b"HEADERDATA-tail");

        assert!(
            b"HEADERDATA-tail".starts_with(b"HEADERDATA"),
            "test premise: the short payload must be a prefix of the long one"
        );

        let short_hash = compute_file_fingerprint(&short).unwrap();
        let long_hash = compute_file_fingerprint(&long).unwrap();
        assert_ne!(
            short_hash, long_hash,
            "differing length must change the fingerprint"
        );

        // Prove the length component is what disambiguates them, without relying on
        // file I/O: hashing the same prefix bytes twice is identical, so a
        // content-only scheme cannot separate a file from its longer twin, while the
        // real fingerprint (length + prefix) does.
        let prefix = b"HEADERDATA";
        let content_only = blake3::hash(prefix).to_hex().to_string();
        assert_eq!(content_only, blake3::hash(prefix).to_hex().to_string());
        assert_ne!(
            content_only, short_hash,
            "the real fingerprint is not a bare content hash"
        );

        let _ = std::fs::remove_file(short);
        let _ = std::fs::remove_file(long);
    }

    #[test]
    fn identical_files_in_different_locations_match() {
        // This is the property hash-based de-duplication relies on.
        let a = temp_file("dup-a.wav", b"identical payload here");
        let b = temp_file("dup-b.wav", b"identical payload here");

        assert_eq!(
            compute_file_fingerprint(&a).unwrap(),
            compute_file_fingerprint(&b).unwrap()
        );

        let _ = std::fs::remove_file(a);
        let _ = std::fs::remove_file(b);
    }

    #[test]
    fn empty_file_is_fingerprintable() {
        let path = temp_file("empty.wav", b"");
        let hash = compute_file_fingerprint(&path).unwrap();
        assert_eq!(hash.len(), 64);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn missing_file_returns_an_error_rather_than_panicking() {
        let missing = std::env::temp_dir().join("dj-assistant-does-not-exist-xyz.wav");
        let _ = std::fs::remove_file(&missing);
        assert!(compute_file_fingerprint(&missing).is_err());
    }
}
