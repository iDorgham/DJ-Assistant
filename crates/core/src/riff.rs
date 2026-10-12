//! Duration parsing for RIFF/WAVE containers.
//!
//! `audiotags` 0.5 reports no duration for WAV files (`duration()` returns
//! `None`), which left every imported `.wav` showing `0 ms` in the library UI.
//!
//! The duration is derived from the `fmt ` chunk's `byte_rate` and the `data`
//! chunk's size, both of which live in the 44-byte canonical header:
//!
//! ```text
//! "RIFF" <u32 riffSize> "WAVE"
//!   "fmt " <u32 16> <u16 audioFormat> <u16 channels> <u32 sampleRate>
//!          <u32 byteRate> <u16 blockAlign> <u16 bitsPerSample>
//!   "data" <u32 dataSize> ...
//! ```
//!
//! Using `byte_rate` rather than `sampleRate * channels * bytesPerSample` keeps
//! this correct for formats where those do not multiply out exactly (e.g. ADPCM).

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

/// Reads a little-endian `u32` at the current position.
fn read_u32<R: Read>(reader: &mut R) -> Option<u32> {
    let mut buf = [0u8; 4];
    reader.read_exact(&mut buf).ok()?;
    Some(u32::from_le_bytes(buf))
}

/// Returns the duration of a WAV/RIFF file in milliseconds, or `None` when the
/// file is not RIFF/WAVE or its headers are incomplete/corrupt.
///
/// Never allocates the audio payload and never panics on malformed input: chunk
/// sizes are validated against the real file length before seeking.
pub fn wav_duration_ms<P: AsRef<Path>>(path: P) -> Option<i64> {
    let mut file = File::open(path).ok()?;
    let total_len = file.metadata().ok()?.len();

    // --- RIFF/WAVE header (12 bytes) ---
    let mut riff = [0u8; 4];
    file.read_exact(&mut riff).ok()?;
    if &riff != b"RIFF" {
        return None;
    }
    let _riff_size = read_u32(&mut file)?;
    let mut form = [0u8; 4];
    file.read_exact(&mut form).ok()?;
    if &form != b"WAVE" {
        return None;
    }

    let mut byte_rate: Option<u32> = None;
    let mut data_size: Option<u32> = None;

    // --- Walk chunks ---
    loop {
        let mut id = [0u8; 4];
        if file.read_exact(&mut id).is_err() {
            break; // clean end of file
        }
        let Some(size) = read_u32(&mut file) else {
            break;
        };

        let payload_start = file.stream_position().ok()?;

        match &id {
            b"fmt " => {
                // audioFormat(2) channels(2) sampleRate(4) byteRate(4) ...
                let mut head = [0u8; 12];
                if file.read_exact(&mut head).is_ok() {
                    byte_rate = Some(u32::from_le_bytes([head[8], head[9], head[10], head[11]]));
                }
            }
            b"data" => {
                // A streamed WAV may declare 0 or 0xFFFFFFFF; fall back to the
                // remaining file length in that case.
                let remaining = total_len.saturating_sub(payload_start);
                let declared = size as u64;
                let usable = declared != 0 && declared != u32::MAX as u64 && declared <= remaining;
                data_size = Some(if usable {
                    size
                } else {
                    remaining.min(u32::MAX as u64) as u32
                });
            }
            _ => {}
        }

        // Once both are known we can stop without scanning the whole payload.
        if byte_rate.is_some() && data_size.is_some() {
            break;
        }

        // Advance to the next chunk. Chunks are word-aligned (padded to even).
        let padded = (size as u64) + (size as u64 % 2);
        let next = payload_start.checked_add(padded)?;
        if next >= total_len {
            break;
        }
        if file.seek(SeekFrom::Start(next)).is_err() {
            break;
        }
    }

    let byte_rate = byte_rate?;
    let data_size = data_size?;
    if byte_rate == 0 {
        return None;
    }

    // milliseconds = data bytes / bytes-per-second * 1000, rounded to nearest.
    let ms = (data_size as u64) * 1000 / (byte_rate as u64);
    Some(ms as i64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    /// Builds a canonical 44-byte-header WAV with `seconds` of silence.
    fn write_wav(path: &Path, seconds: f64, channels: u16, sample_rate: u32, bits: u16) {
        let block_align = channels * bits / 8;
        let byte_rate = sample_rate * block_align as u32;
        let data_size = (byte_rate as f64 * seconds) as u32;

        let mut buf = Vec::new();
        buf.extend_from_slice(b"RIFF");
        buf.extend_from_slice(&(36 + data_size).to_le_bytes());
        buf.extend_from_slice(b"WAVE");
        buf.extend_from_slice(b"fmt ");
        buf.extend_from_slice(&16u32.to_le_bytes());
        buf.extend_from_slice(&1u16.to_le_bytes()); // PCM
        buf.extend_from_slice(&channels.to_le_bytes());
        buf.extend_from_slice(&sample_rate.to_le_bytes());
        buf.extend_from_slice(&byte_rate.to_le_bytes());
        buf.extend_from_slice(&block_align.to_le_bytes());
        buf.extend_from_slice(&bits.to_le_bytes());
        buf.extend_from_slice(b"data");
        buf.extend_from_slice(&data_size.to_le_bytes());
        buf.extend(std::iter::repeat_n(0u8, data_size as usize));

        let mut f = File::create(path).unwrap();
        f.write_all(&buf).unwrap();
    }

    fn temp_path(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join("dj-assistant-wav-duration");
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(name)
    }

    #[test]
    fn computes_duration_for_canonical_pcm_wav() {
        let path = temp_path("one-second.wav");
        write_wav(&path, 1.0, 2, 44_100, 16);
        assert_eq!(wav_duration_ms(&path), Some(1000));
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn computes_duration_for_half_second() {
        let path = temp_path("half-second.wav");
        write_wav(&path, 0.5, 2, 44_100, 16);
        let ms = wav_duration_ms(&path).unwrap();
        assert!((ms - 500).abs() <= 1, "expected ~500ms, got {ms}");
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn handles_mono_and_other_bit_depths() {
        let path = temp_path("mono-24.wav");
        write_wav(&path, 2.0, 1, 48_000, 24);
        let ms = wav_duration_ms(&path).unwrap();
        assert!((ms - 2000).abs() <= 1, "expected ~2000ms, got {ms}");
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn non_riff_file_returns_none() {
        let path = temp_path("garbage.wav");
        let mut f = File::create(&path).unwrap();
        f.write_all(b"this is not a wave file at all").unwrap();
        assert_eq!(wav_duration_ms(&path), None);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn truncated_header_returns_none() {
        let path = temp_path("truncated.wav");
        let mut f = File::create(&path).unwrap();
        f.write_all(b"RIFF\x00\x00").unwrap();
        assert_eq!(wav_duration_ms(&path), None);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn empty_file_returns_none() {
        let path = temp_path("empty.wav");
        File::create(&path).unwrap();
        assert_eq!(wav_duration_ms(&path), None);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn missing_file_returns_none() {
        assert_eq!(wav_duration_ms(temp_path("nope-does-not-exist.wav")), None);
    }

    #[test]
    fn skipped_unknown_chunks_are_tolerated() {
        // Insert a LIST chunk before fmt/data; the walker must skip it.
        let path = temp_path("with-list.wav");
        let block_align = 2u16 * 16 / 8;
        let byte_rate = 44_100u32 * block_align as u32;
        let data_size = byte_rate / 2; // 0.5s

        let mut buf = Vec::new();
        buf.extend_from_slice(b"RIFF");
        buf.extend_from_slice(&(4 + (8 + 10) + (8 + 16) + (8 + data_size)).to_le_bytes());
        buf.extend_from_slice(b"WAVE");
        buf.extend_from_slice(b"LIST");
        buf.extend_from_slice(&10u32.to_le_bytes());
        buf.extend_from_slice(b"INFOhello!"); // 10 bytes, even
        buf.extend_from_slice(b"fmt ");
        buf.extend_from_slice(&16u32.to_le_bytes());
        buf.extend_from_slice(&1u16.to_le_bytes());
        buf.extend_from_slice(&2u16.to_le_bytes());
        buf.extend_from_slice(&44_100u32.to_le_bytes());
        buf.extend_from_slice(&byte_rate.to_le_bytes());
        buf.extend_from_slice(&block_align.to_le_bytes());
        buf.extend_from_slice(&16u16.to_le_bytes());
        buf.extend_from_slice(b"data");
        buf.extend_from_slice(&data_size.to_le_bytes());
        buf.extend(std::iter::repeat_n(0u8, data_size as usize));

        let mut f = File::create(&path).unwrap();
        f.write_all(&buf).unwrap();

        let ms = wav_duration_ms(&path).unwrap();
        assert!((ms - 500).abs() <= 1, "expected ~500ms, got {ms}");
        let _ = std::fs::remove_file(path);
    }
}
