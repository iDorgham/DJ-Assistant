//! Duration parsing for AIFF/AIFF-C containers.
//!
//! `audiotags` 0.5 has no AIFF backend at all (`TagType::try_from_ext` rejects
//! it), so AIFF files previously reported `0 ms` — the same class of bug as WAV.
//!
//! AIFF stores duration in the `COMM` (Common) chunk as `numSampleFrames`
//! together with `sampleRate`, which is an 80-bit IEEE 754 extended-precision
//! float:
//!
//! ```text
//! "FORM" <u32 formSize> "AIFF"
//!   "COMM" <u32 18> <u16 numChannels> <u32 numSampleFrames> <u16 sampleSize>
//!          <10-byte extended sampleRate> ...
//!   "SSND" <u32 soundDataSize> ...
//! ```
//!
//! `duration = numSampleFrames / sampleRate`. Reading it from the header means
//! the audio payload is never decoded.

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

fn read_u32<R: Read>(reader: &mut R) -> Option<u32> {
    let mut buf = [0u8; 4];
    reader.read_exact(&mut buf).ok()?;
    Some(u32::from_be_bytes(buf))
}

/// Decodes an 80-bit IEEE 754 extended-precision float.
///
/// Layout: 1 sign bit, 15 exponent bits (bias 16383), 64-bit significand with an
/// explicit integer bit. Used by AIFF for the sample rate.
fn extended_to_f64(bytes: &[u8; 10]) -> f64 {
    let sign = if bytes[0] & 0x80 != 0 { -1.0 } else { 1.0 };
    let exponent = (((bytes[0] as u16 & 0x7F) << 8) | bytes[1] as u16) as i32;

    let mut mantissa: u64 = 0;
    for &b in &bytes[2..10] {
        mantissa = (mantissa << 8) | b as u64;
    }

    if exponent == 0 && mantissa == 0 {
        return 0.0;
    }
    // 0x7FFF is infinity/NaN; clamp rather than propagate nonsense.
    if exponent == 0x7FFF {
        return 0.0;
    }

    let value = (mantissa as f64) * 2f64.powi(exponent - 16383 - 63);
    sign * value
}

/// Returns the duration of an AIFF/AIFF-C file in milliseconds, or `None` when
/// the file is not AIFF or its `COMM` chunk is missing/implausible.
///
/// Never allocates the audio payload and never panics on malformed input.
pub fn aiff_duration_ms<P: AsRef<Path>>(path: P) -> Option<i64> {
    let mut file = File::open(path).ok()?;
    let total_len = file.metadata().ok()?.len();
    if total_len < 12 {
        return None;
    }

    // --- FORM/AIFF header (12 bytes, big-endian) ---
    let mut form = [0u8; 4];
    file.read_exact(&mut form).ok()?;
    if &form != b"FORM" {
        return None;
    }
    let _form_size = read_u32(&mut file)?;
    let mut kind = [0u8; 4];
    file.read_exact(&mut kind).ok()?;
    if &kind != b"AIFF" && &kind != b"AIFC" {
        return None;
    }

    // --- Walk chunks ---
    loop {
        let mut id = [0u8; 4];
        if file.read_exact(&mut id).is_err() {
            break;
        }
        let Some(size) = read_u32(&mut file) else {
            break;
        };
        let payload_start = file.stream_position().ok()?;

        if &id == b"COMM" {
            // numChannels(2) numSampleFrames(4) sampleSize(2) sampleRate(10)
            let mut head = [0u8; 8];
            if file.read_exact(&mut head).is_err() {
                return None;
            }
            let num_sample_frames = u32::from_be_bytes([head[2], head[3], head[4], head[5]]) as f64;

            let mut rate_bytes = [0u8; 10];
            if file.read_exact(&mut rate_bytes).is_err() {
                return None;
            }
            let sample_rate = extended_to_f64(&rate_bytes);
            if sample_rate <= 0.0 || !sample_rate.is_finite() || num_sample_frames <= 0.0 {
                return None;
            }

            let ms = (num_sample_frames / sample_rate * 1000.0).round();
            if !ms.is_finite() || ms < 0.0 {
                return None;
            }
            return Some(ms as i64);
        }

        // Skip this chunk (chunks are word-aligned; pad odd sizes).
        let padded = (size as u64) + (size as u64 % 2);
        let next = payload_start.checked_add(padded)?;
        if next >= total_len {
            break;
        }
        if file.seek(SeekFrom::Start(next)).is_err() {
            break;
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    /// Encodes a positive f64 as an 80-bit IEEE 754 extended float.
    ///
    /// The 64-bit significand carries an *explicit* integer bit at position 63, so
    /// after normalising into [1,2) the significand is `v * 2^63` and the biased
    /// exponent is `16383 + e`, matching [`extended_to_f64`].
    fn f64_to_extended(value: f64) -> [u8; 10] {
        if value == 0.0 || !value.is_finite() || value < 0.0 {
            return [0u8; 10];
        }
        let mut buf = [0u8; 10];
        let mut v = value;
        let mut exponent: i32 = 16383;

        // Normalise into [1, 2), tracking the binary exponent.
        while v >= 2.0 {
            v /= 2.0;
            exponent += 1;
        }
        while v < 1.0 {
            v *= 2.0;
            exponent -= 1;
        }

        buf[0] = ((exponent >> 8) & 0x7F) as u8;
        buf[1] = (exponent & 0xFF) as u8;

        let mantissa = (v * 2f64.powi(63)) as u64;
        buf[2..10].copy_from_slice(&mantissa.to_be_bytes());
        buf
    }

    fn write_aiff(path: &Path, sample_frames: u32, sample_rate: f64, channels: u16, bits: u16) {
        let mut buf = Vec::new();
        buf.extend_from_slice(b"FORM");
        buf.extend_from_slice(&0u32.to_be_bytes()); // size placeholder
        buf.extend_from_slice(b"AIFF");

        // COMM chunk (18 bytes)
        buf.extend_from_slice(b"COMM");
        buf.extend_from_slice(&18u32.to_be_bytes());
        buf.extend_from_slice(&channels.to_be_bytes());
        buf.extend_from_slice(&sample_frames.to_be_bytes());
        buf.extend_from_slice(&bits.to_be_bytes());
        buf.extend_from_slice(&f64_to_extended(sample_rate));

        // SSND chunk with a small payload
        let sound_bytes = 16u32;
        buf.extend_from_slice(b"SSND");
        buf.extend_from_slice(&(sound_bytes + 8).to_be_bytes());
        buf.extend_from_slice(&0u32.to_be_bytes()); // offset
        buf.extend_from_slice(&0u32.to_be_bytes()); // blockSize
        buf.extend(std::iter::repeat_n(0u8, sound_bytes as usize));

        let form_size = (buf.len() - 8) as u32;
        buf[4..8].copy_from_slice(&form_size.to_be_bytes());

        let mut f = File::create(path).unwrap();
        f.write_all(&buf).unwrap();
    }

    fn temp_path(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join("dj-assistant-aiff-duration");
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(name)
    }

    #[test]
    fn extended_float_roundtrips_common_sample_rates() {
        for rate in [44_100.0, 48_000.0, 22_050.0, 96_000.0, 8_000.0] {
            let decoded = extended_to_f64(&f64_to_extended(rate));
            assert!(
                (decoded - rate).abs() < 0.5,
                "extended float roundtrip failed for {rate}: got {decoded}"
            );
        }
        assert_eq!(extended_to_f64(&[0u8; 10]), 0.0);
    }

    /// Pins the decoder against the canonical 80-bit encoding of 44100 Hz, which
    /// is what real AIFF writers emit (`0x400EAC440000000000`). Guards against
    /// regressing the explicit-integer-bit handling.
    #[test]
    fn decodes_known_44100_encoding() {
        let bytes = [0x40, 0x0E, 0xAC, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
        assert_eq!(extended_to_f64(&bytes), 44_100.0);
    }

    #[test]
    fn computes_duration_from_comm_chunk() {
        let path = temp_path("half-second.aiff");
        write_aiff(&path, 22_050, 44_100.0, 2, 16);
        let ms = aiff_duration_ms(&path).unwrap();
        assert!((ms - 500).abs() <= 1, "expected ~500ms, got {ms}");
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn computes_duration_for_48k() {
        let path = temp_path("48k.aiff");
        // 96_000 frames at 48 kHz = 2 s
        write_aiff(&path, 96_000, 48_000.0, 1, 24);
        let ms = aiff_duration_ms(&path).unwrap();
        assert!((ms - 2000).abs() <= 1, "expected ~2000ms, got {ms}");
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn skips_unknown_chunks_before_comm() {
        // Some writers emit metadata chunks ahead of COMM.
        let path = temp_path("with-leading-chunk.aiff");
        let mut buf = Vec::new();
        buf.extend_from_slice(b"FORM");
        buf.extend_from_slice(&0u32.to_be_bytes());
        buf.extend_from_slice(b"AIFF");
        buf.extend_from_slice(b"NAME");
        buf.extend_from_slice(&6u32.to_be_bytes());
        buf.extend_from_slice(b"hello!"); // 6 bytes, even
        buf.extend_from_slice(b"COMM");
        buf.extend_from_slice(&18u32.to_be_bytes());
        buf.extend_from_slice(&2u16.to_be_bytes());
        buf.extend_from_slice(&44_100u32.to_be_bytes()); // 1 s
        buf.extend_from_slice(&16u16.to_be_bytes());
        buf.extend_from_slice(&f64_to_extended(44_100.0));

        let form_size = (buf.len() - 8) as u32;
        buf[4..8].copy_from_slice(&form_size.to_be_bytes());
        let mut f = File::create(&path).unwrap();
        f.write_all(&buf).unwrap();

        let ms = aiff_duration_ms(&path).unwrap();
        assert!((ms - 1000).abs() <= 1, "expected ~1000ms, got {ms}");
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn non_aiff_returns_none() {
        let path = temp_path("garbage.aiff");
        let mut f = File::create(&path).unwrap();
        f.write_all(b"this is not aiff at all, really").unwrap();
        assert_eq!(aiff_duration_ms(&path), None);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn header_only_returns_none() {
        // Mirrors the corrupt/header-only.aiff fixture: FORM/AIFF with no COMM.
        let path = temp_path("header-only.aiff");
        let mut f = File::create(&path).unwrap();
        f.write_all(b"FORM\x00\x00\x00\x04AIFF").unwrap();
        assert_eq!(aiff_duration_ms(&path), None);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn empty_and_missing_files_return_none() {
        let path = temp_path("empty.aiff");
        File::create(&path).unwrap();
        assert_eq!(aiff_duration_ms(&path), None);
        let _ = std::fs::remove_file(path);
        assert_eq!(aiff_duration_ms(temp_path("missing-xyz.aiff")), None);
    }

    #[test]
    fn aifc_variant_is_accepted() {
        let path = temp_path("compressed.aifc");
        let mut buf = Vec::new();
        buf.extend_from_slice(b"FORM");
        buf.extend_from_slice(&0u32.to_be_bytes());
        buf.extend_from_slice(b"AIFC");
        buf.extend_from_slice(b"COMM");
        buf.extend_from_slice(&18u32.to_be_bytes());
        buf.extend_from_slice(&2u16.to_be_bytes());
        buf.extend_from_slice(&44_100u32.to_be_bytes());
        buf.extend_from_slice(&16u16.to_be_bytes());
        buf.extend_from_slice(&f64_to_extended(44_100.0));
        let form_size = (buf.len() - 8) as u32;
        buf[4..8].copy_from_slice(&form_size.to_be_bytes());

        let mut f = File::create(&path).unwrap();
        f.write_all(&buf).unwrap();

        let ms = aiff_duration_ms(&path).unwrap();
        assert!((ms - 1000).abs() <= 1, "expected ~1000ms, got {ms}");
        let _ = std::fs::remove_file(path);
    }
}
