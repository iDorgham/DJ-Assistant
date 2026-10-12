//! Duration parsing for MPEG audio (MP3) files.
//!
//! `audiotags` 0.5 exposes no duration for MP3 either, which left every imported
//! MP3 at `0 ms` — for a real DJ library that is ~99% of tracks, so the library
//! UI showed `--:--` almost everywhere.
//!
//! Duration is derived in this order:
//!
//! 1. **Xing/Info header** — a frame count written by LAME and friends, giving an
//!    exact duration (frame count × samples-per-frame ÷ sample rate).
//! 2. **VBRI header** — Fraunhofer's equivalent, also carrying a frame count.
//! 3. **CBR estimate** — file length ÷ (bitrate ÷ 8), used when no frame count is
//!    present. Accurate for constant-bitrate files, approximate for VBR.
//!
//! The MPEG audio payload is never decoded.

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

/// Samples per frame for MPEG-1 Layer III; MPEG-2/2.5 Layer III uses half.
const SAMPLES_PER_FRAME_MPEG1_LAYER3: u32 = 1152;
const SAMPLES_PER_FRAME_MPEG2_LAYER3: u32 = 576;

/// MPEG-1 Layer III bitrates (kbps), indexed by the 4-bit bitrate field.
const BITRATES_V1_L3: [u32; 16] = [
    0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
];
/// MPEG-2/2.5 Layer III bitrates (kbps).
const BITRATES_V2_L3: [u32; 16] = [
    0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
];
/// MPEG-1 Layer II bitrates.
const BITRATES_V1_L2: [u32; 16] = [
    0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0,
];

/// A parsed MPEG audio frame header.
#[derive(Debug, Clone, Copy)]
struct FrameHeader {
    /// 1 = MPEG-1, 2 = MPEG-2, 25 = MPEG-2.5
    version: u8,
    /// 1, 2 or 3 (Layer I/II/III)
    layer: u8,
    bitrate_kbps: u32,
    sample_rate: u32,
    /// True when the frame carries padding, which shifts the frame length by 1.
    padding: bool,
}

/// Byte length of this frame, per the MPEG spec.
fn frame_length(header: &FrameHeader) -> u32 {
    let samples = samples_per_frame(header.version, header.layer);
    let coefficient: u32 = if header.layer == 1 { 4 } else { 1 };
    let mut len = (samples / 8 * header.bitrate_kbps * 1000 / header.sample_rate) * coefficient;
    if header.padding {
        len += coefficient;
    }
    len
}

fn samples_per_frame(version: u8, layer: u8) -> u32 {
    match (version, layer) {
        // MPEG-1
        (1, 1) => 384,
        (1, 2) => 1152,
        (1, _) => SAMPLES_PER_FRAME_MPEG1_LAYER3,
        // MPEG-2 / 2.5
        (_, 1) => 384,
        (_, 2) => 1152,
        (_, _) => SAMPLES_PER_FRAME_MPEG2_LAYER3,
    }
}

/// Attempts to parse a 4-byte MPEG audio frame header at `bytes`.
fn parse_header(bytes: &[u8]) -> Option<FrameHeader> {
    if bytes.len() < 4 {
        return None;
    }
    // Frame sync: 11 bits set.
    if bytes[0] != 0xFF || (bytes[1] & 0xE0) != 0xE0 {
        return None;
    }

    let version_bits = (bytes[1] >> 3) & 0b11;
    let layer_bits = (bytes[1] >> 1) & 0b11;
    let bitrate_index = (bytes[2] >> 4) & 0b1111;
    let sample_rate_bits = (bytes[2] >> 2) & 0b11;
    let padding = (bytes[2] >> 1) & 0b1 == 1;

    // 0b01 is reserved.
    let version = match version_bits {
        0b00 => 25, // MPEG 2.5
        0b10 => 2,
        0b11 => 1,
        _ => return None,
    };
    // 0b00 is reserved.
    let layer = match layer_bits {
        0b01 => 3,
        0b10 => 2,
        0b11 => 1,
        _ => return None,
    };

    let base_rate = match sample_rate_bits {
        0b00 => 44_100,
        0b01 => 48_000,
        0b10 => 32_000,
        _ => return None,
    };
    let sample_rate = match version {
        1 => base_rate,
        2 => base_rate / 2,
        _ => base_rate / 4,
    };

    let bitrate_kbps = match (version, layer) {
        (1, 3) => BITRATES_V1_L3[bitrate_index as usize],
        (1, 2) => BITRATES_V1_L2[bitrate_index as usize],
        (1, _) => BITRATES_V1_L2[bitrate_index as usize],
        // MPEG-2/2.5 Layer I shares the v1 Layer II table; Layers II/III the v2 table.
        (_, 1) => BITRATES_V1_L2[bitrate_index as usize],
        _ => BITRATES_V2_L3[bitrate_index as usize],
    };
    if bitrate_kbps == 0 {
        return None; // "free" bitrate or invalid index
    }

    Some(FrameHeader {
        version,
        layer,
        bitrate_kbps,
        sample_rate,
        padding,
    })
}

/// Reads the ID3v2 tag size so frame scanning can start at the real audio data.
fn id3v2_size(file: &mut File) -> u64 {
    let mut header = [0u8; 10];
    if file.read_exact(&mut header).is_err() {
        return 0;
    }
    if &header[0..3] != b"ID3" {
        return 0;
    }
    // Size is 4 syncsafe bytes (7 bits each); the 10-byte header precedes the tag.
    let size = ((header[6] as u64 & 0x7F) << 21)
        | ((header[7] as u64 & 0x7F) << 14)
        | ((header[8] as u64 & 0x7F) << 7)
        | (header[9] as u64 & 0x7F);
    10 + size
}

/// Scans `data` for the first plausible frame header, returning (offset, header).
fn find_first_frame(data: &[u8]) -> Option<(usize, FrameHeader)> {
    for offset in 0..data.len().saturating_sub(4) {
        if let Some(header) = parse_header(&data[offset..]) {
            // Guard against false syncs: reject frames whose length would be absurd.
            let len = frame_length(&header);
            if (24..=5000).contains(&len) {
                return Some((offset, header));
            }
        }
    }
    None
}

/// Reads a big-endian u32 from `data` at `offset`.
fn be_u32(data: &[u8], offset: usize) -> Option<u32> {
    let end = offset.checked_add(4)?;
    let slice = data.get(offset..end)?;
    Some(u32::from_be_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

/// Looks for a Xing/Info (or VBRI) header inside the first frame and returns the
/// declared frame count.
fn frame_count_from_side_info(data: &[u8], first_frame_offset: usize) -> Option<u32> {
    // Xing/Info lives at a fixed offset after the frame header, which depends on
    // the channel mode. Try the common offsets (mono 17, stereo 32 from frame start).
    let frame = data.get(first_frame_offset..)?;
    for offset in [21usize, 36usize] {
        let tag = frame.get(offset..offset + 4)?;
        if tag == b"Xing" || tag == b"Info" {
            // After the 4-byte tag comes a 4-byte flags field, then (if the frame
            // count flag 0x1 is set) a 4-byte frame count.
            let flags = be_u32(frame, offset + 4)?;
            if flags & 0x1 != 0 {
                return be_u32(frame, offset + 8);
            }
            return None;
        }
    }

    // VBRI is always 32 bytes after the frame header.
    if let Some(tag) = frame.get(36..40) {
        if tag == b"VBRI" {
            return be_u32(frame, 36 + 10);
        }
    }

    None
}

/// Returns the duration of an MP3 file in milliseconds, or `None` when no valid
/// MPEG frame can be found (i.e. the file is not MP3 audio).
///
/// Never decodes audio and never panics on malformed input.
pub fn mp3_duration_ms<P: AsRef<Path>>(path: P) -> Option<i64> {
    let mut file = File::open(path).ok()?;
    let total_len = file.metadata().ok()?.len();
    if total_len < 4 {
        return None;
    }

    let audio_start = id3v2_size(&mut file);
    if audio_start >= total_len {
        return None; // tag only, no audio
    }
    file.seek(SeekFrom::Start(audio_start)).ok()?;

    // Read enough to contain the first frame plus any Xing/VBRI header.
    let mut probe = vec![0u8; 8192.min((total_len - audio_start) as usize)];
    let read = file.read(&mut probe).ok()?;
    probe.truncate(read);

    let (offset, header) = find_first_frame(&probe)?;
    let samples = samples_per_frame(header.version, header.layer) as f64;
    let sample_rate = header.sample_rate as f64;

    // 1 & 2: explicit frame count.
    if let Some(frames) = frame_count_from_side_info(&probe, offset) {
        if frames > 0 {
            let ms = frames as f64 * samples / sample_rate * 1000.0;
            if ms.is_finite() && ms > 0.0 {
                return Some(ms.round() as i64);
            }
        }
    }

    // 3: CBR estimate from the audio payload length.
    let audio_bytes = total_len - audio_start;
    let bytes_per_second = header.bitrate_kbps as f64 * 1000.0 / 8.0;
    if bytes_per_second <= 0.0 {
        return None;
    }
    let ms = audio_bytes as f64 / bytes_per_second * 1000.0;
    if !ms.is_finite() || ms <= 0.0 {
        return None;
    }
    Some(ms.round() as i64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn temp_path(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join("dj-assistant-mp3-duration");
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(name)
    }

    /// Builds a 128 kbps / 44.1 kHz MPEG-1 Layer III frame header.
    fn frame_header_bytes() -> [u8; 4] {
        // 0xFF 0xFB = sync + MPEG1 + Layer III + no CRC
        // 0x90 = bitrate index 9 (128 kbps) + sample rate 0 (44100) + no padding
        [0xFF, 0xFB, 0x90, 0x00]
    }

    fn write_cbr_mp3(path: &Path, frames: usize) {
        let mut buf = Vec::new();
        buf.extend_from_slice(&frame_header_bytes());
        // 128 kbps @ 44.1 kHz -> frame length 417 bytes
        buf.extend(std::iter::repeat_n(0u8, 417 - 4));
        let frame = buf.clone();
        for _ in 1..frames {
            buf.extend_from_slice(&frame);
        }
        let mut f = File::create(path).unwrap();
        f.write_all(&buf).unwrap();
    }

    #[test]
    fn parses_mpeg1_layer3_header() {
        let h = parse_header(&frame_header_bytes()).expect("valid header");
        assert_eq!(h.version, 1);
        assert_eq!(h.layer, 3);
        assert_eq!(h.bitrate_kbps, 128);
        assert_eq!(h.sample_rate, 44_100);
        assert_eq!(frame_length(&h), 417);
    }

    #[test]
    fn rejects_reserved_and_non_sync_bytes() {
        assert!(parse_header(&[0x00, 0x00, 0x00, 0x00]).is_none());
        // Version bits 0b01 are reserved.
        assert!(parse_header(&[0xFF, 0xEB, 0x90, 0x00]).is_none());
        // Layer bits 0b00 are reserved.
        assert!(parse_header(&[0xFF, 0xFB & 0xF9, 0x90, 0x00]).is_none());
        // Bitrate index 0 (free) is unsupported.
        assert!(parse_header(&[0xFF, 0xFB, 0x00, 0x00]).is_none());
    }

    #[test]
    fn estimates_cbr_duration_without_xing_header() {
        // 100 frames at 1152 samples / 44100 Hz = 2.612 s.
        //
        // Without a Xing/VBRI frame count the duration comes from
        // bytes / (bitrate / 8), which is the *audio payload* length, so it differs
        // slightly from the frame-count total (the estimate here lands ~6 ms low on
        // a 2.6 s file). That sub-0.5% error is the documented cost of the fallback;
        // it is why the Xing path exists and is preferred.
        let path = temp_path("cbr.mp3");
        write_cbr_mp3(&path, 100);

        let ms = mp3_duration_ms(&path).unwrap();
        let frame_based = (100.0_f64 * 1152.0 / 44_100.0 * 1000.0).round() as i64;

        assert!(
            (ms - frame_based).abs() <= 20,
            "byte-rate estimate should be within 20ms of {frame_based}ms, got {ms}"
        );
        assert!(ms > 0, "duration must be a real value, not zero");
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn uses_xing_frame_count_when_present() {
        // A Xing header declaring 200 frames must win over the byte estimate.
        let path = temp_path("xing.mp3");
        let mut buf = Vec::new();
        buf.extend_from_slice(&frame_header_bytes());
        buf.extend(std::iter::repeat_n(0u8, 417 - 4));
        // Place "Xing" + flags(frame count) + frame count at offset 21 from frame start.
        buf[21..25].copy_from_slice(b"Xing");
        buf[25..29].copy_from_slice(&1u32.to_be_bytes()); // flags: frame count present
        buf[29..33].copy_from_slice(&200u32.to_be_bytes()); // 200 frames
        for _ in 1..10 {
            buf.extend_from_slice(&{
                let mut f = Vec::new();
                f.extend_from_slice(&frame_header_bytes());
                f.extend(std::iter::repeat_n(0u8, 417 - 4));
                f
            });
        }
        let mut f = File::create(&path).unwrap();
        f.write_all(&buf).unwrap();

        let ms = mp3_duration_ms(&path).unwrap();
        let expected = (200.0_f64 * 1152.0 / 44_100.0 * 1000.0).round() as i64;
        assert!(
            (ms - expected).abs() <= 2,
            "Xing frame count should win: expected ~{expected}ms, got {ms}"
        );
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn skips_id3v2_tag_before_finding_frames() {
        let path = temp_path("with-id3.mp3");
        let mut buf = Vec::new();
        // ID3v2 header with a 100-byte body.
        buf.extend_from_slice(b"ID3");
        buf.extend_from_slice(&[0x04, 0x00, 0x00]);
        buf.extend_from_slice(&[0x00, 0x00, 0x00, 100]); // syncsafe 100
        buf.extend(std::iter::repeat_n(0u8, 100));
        // Then 50 real frames.
        for _ in 0..50 {
            buf.extend_from_slice(&frame_header_bytes());
            buf.extend(std::iter::repeat_n(0u8, 417 - 4));
        }
        let mut f = File::create(&path).unwrap();
        f.write_all(&buf).unwrap();

        let ms = mp3_duration_ms(&path).unwrap();
        let expected = (50.0_f64 * 1152.0 / 44_100.0 * 1000.0).round() as i64;
        assert!(
            (ms - expected).abs() <= 20,
            "expected ~{expected}ms, got {ms}"
        );
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn garbage_and_empty_files_return_none() {
        let garbage = temp_path("garbage.mp3");
        let mut f = File::create(&garbage).unwrap();
        f.write_all(b"this is definitely not an mp3 file").unwrap();
        assert_eq!(mp3_duration_ms(&garbage), None);
        let _ = std::fs::remove_file(garbage);

        let empty = temp_path("empty.mp3");
        File::create(&empty).unwrap();
        assert_eq!(mp3_duration_ms(&empty), None);
        let _ = std::fs::remove_file(empty);

        assert_eq!(mp3_duration_ms(temp_path("missing-xyz.mp3")), None);
    }

    #[test]
    fn id3_only_file_returns_none() {
        // A tag with no audio frames must not report a duration.
        let path = temp_path("tag-only.mp3");
        let mut buf = Vec::new();
        buf.extend_from_slice(b"ID3");
        buf.extend_from_slice(&[0x04, 0x00, 0x00]);
        buf.extend_from_slice(&[0x00, 0x00, 0x00, 20]);
        buf.extend(std::iter::repeat_n(0u8, 20));
        let mut f = File::create(&path).unwrap();
        f.write_all(&buf).unwrap();
        assert_eq!(mp3_duration_ms(&path), None);
        let _ = std::fs::remove_file(path);
    }
}
