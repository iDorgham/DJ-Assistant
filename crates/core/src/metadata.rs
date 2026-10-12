//! Tag metadata extraction via `audiotags` (id3 / metaflac / mp4ameta backends).
//!
//! Extraction is intentionally forgiving: a file whose tags cannot be parsed is
//! still importable, using its filename stem as the title and "Unknown Artist"
//! as the artist. That keeps one malformed file from failing a whole library scan
//! (SDD acceptance P0.7).

use std::path::{Path, PathBuf};

use audiotags::Tag;
use id3::{frame::PictureType as Id3PictureType, TagLike};

/// Embedded cover art as found in the file's tags, before it is cached to disk.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmbeddedArtwork {
    /// Declared MIME type, e.g. `image/jpeg`.
    pub mime_type: String,
    /// Raw image bytes.
    pub data: Vec<u8>,
}

/// A content-addressed reference to artwork written to the local cache.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CachedArtwork {
    /// BLAKE3 hex digest of the image bytes (stable across rescans).
    pub hash: String,
    /// Absolute path the image was cached to.
    pub path: PathBuf,
    /// MIME type carried over from the tag.
    pub mime_type: String,
}

/// Metadata pulled from an audio file. Every field is best-effort.
#[derive(Debug, Clone, PartialEq)]
pub struct ExtractedMetadata {
    /// Tag title, falling back to the filename stem.
    pub title: String,
    /// Tag artist, falling back to "Unknown Artist".
    pub artist: String,
    pub album: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i32>,
    /// Duration in milliseconds; `0` when the container reports none.
    pub duration_ms: i64,
    /// Lowercased file extension, e.g. "flac".
    pub format: String,
    pub file_size: i64,
    /// BPM read straight from the file tags (not analysed). `None` when absent.
    pub bpm: Option<f64>,
    /// Camelot key code (e.g. `8A`) when the tag contains one or can be mapped.
    pub key_camelot: Option<String>,
    /// Classical key name (e.g. `A minor`) when present in the tags.
    pub key_classical: Option<String>,
    /// Star rating 0–5, mapped from `POPM` / `RATING` tags. `None` when unrated.
    pub rating: Option<i64>,
    /// Free-text comment tag, if any.
    pub comments: Option<String>,
    /// Embedded cover art, if any.
    pub artwork: Option<EmbeddedArtwork>,
}

fn non_empty(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

/// Reads just the recording year via a direct ID3 parse.
///
/// `audiotags` does not map the ID3v2.4 `TDRC` frame (used by ffmpeg and
/// mutagen) on any container, so this is consulted whenever the primary reader
/// returns no year.
fn id3_year_from_file(path: &Path) -> Option<i32> {
    id3::Tag::read_from_path(path)
        .ok()
        .and_then(|tag| id3_year(&tag))
}

/// Extracts a recording year, tolerating both ID3v2.3 and ID3v2.4 frames.
///
/// `id3::TagLike::year()` does not map `TDRC` (the ID3v2.4 recording-time frame),
/// which is exactly what ffmpeg and mutagen write, so the frame text is parsed as
/// a fallback. Values may be full timestamps like `2021-03-04T10:00:00`.
fn id3_year(tag: &id3::Tag) -> Option<i32> {
    if let Some(year) = tag.year() {
        return Some(year);
    }

    for frame_id in ["TDRC", "TYER", "TDAT"] {
        if let Some(frame) = tag.get(frame_id) {
            if let Some(text) = frame.content().text() {
                let digits: String = text.chars().take_while(char::is_ascii_digit).collect();
                if digits.len() >= 4 {
                    if let Ok(year) = digits[..4].parse::<i32>() {
                        return Some(year);
                    }
                }
            }
        }
    }

    None
}

/// Reads ID3 tags via the `id3` crate.
///
/// Needed because `audiotags` 0.5 does not support AIFF at all — it fails with
/// "Unsupported format: aiff" — while `.aif`/`.aiff` are advertised formats that
/// the scanner imports. AIFF stores ID3 in an `ID3 ` chunk, which `id3` reads.
/// Returns `None` when no usable tags are present.
fn read_id3(path: &Path) -> Option<ExtractedMetadata> {
    let tag = id3::Tag::read_from_path(path).ok()?;

    let title = non_empty(tag.title());
    let artist = non_empty(tag.artist());
    let album = non_empty(tag.album());
    let genre = non_empty(tag.genre());
    let year = id3_year(&tag);

    // Nothing useful found: let the caller use its own fallbacks.
    if title.is_none() && artist.is_none() && album.is_none() && genre.is_none() && year.is_none() {
        return None;
    }

    Some(ExtractedMetadata {
        title: title.unwrap_or_default(),
        artist: artist.unwrap_or_default(),
        album,
        genre,
        year,
        // `id3` has no notion of stream duration.
        duration_ms: 0,
        format: String::new(),
        file_size: 0,
        // Extras are merged separately by `extract_metadata`.
        bpm: None,
        key_camelot: None,
        key_classical: None,
        rating: None,
        comments: None,
        artwork: None,
    })
}

/// Reads metadata from `path`.
///
/// Returns `Err` only when the file itself cannot be read (missing, permissions).
/// A file that exists but has unparseable or absent tags returns `Ok` with
/// fallback values.
pub fn extract_metadata<P: AsRef<Path>>(path: P) -> Result<ExtractedMetadata, String> {
    let path_ref = path.as_ref();

    let file_size = std::fs::metadata(path_ref)
        .map_err(|e| format!("cannot read file metadata: {e}"))?
        .len() as i64;

    let extension = path_ref
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("unknown")
        .to_lowercase();

    let fallback_title = path_ref
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled")
        .to_string();

    let fallback = |duration_ms: i64| ExtractedMetadata {
        title: fallback_title.clone(),
        artist: "Unknown Artist".to_string(),
        album: None,
        genre: None,
        year: None,
        duration_ms,
        format: extension.clone(),
        file_size,
        bpm: None,
        key_camelot: None,
        key_classical: None,
        rating: None,
        comments: None,
        artwork: None,
    };

    let mut meta = match Tag::new().read_from_path(path_ref) {
        Ok(tag) => {
            let title = non_empty(tag.title()).unwrap_or_else(|| fallback_title.clone());
            let artist = non_empty(tag.artist()).unwrap_or_else(|| "Unknown Artist".to_string());

            // `audiotags` returns None for WAV (and has no AIFF backend at all),
            // so fall back to a container-specific header parse rather than
            // storing 0 and showing "--:--" in the library UI.
            let duration_ms = tag
                .duration()
                .map(|d| (d * 1000.0) as i64)
                .filter(|ms| *ms > 0)
                .or_else(|| crate::container_duration_ms(path_ref))
                .unwrap_or(0);

            ExtractedMetadata {
                title,
                artist,
                album: non_empty(tag.album_title()),
                genre: non_empty(tag.genre()),
                year: tag.year().or_else(|| id3_year_from_file(path_ref)),
                duration_ms,
                format: extension,
                file_size,
                bpm: None,
                key_camelot: None,
                key_classical: None,
                rating: None,
                comments: None,
                artwork: None,
            }
        }
        // `audiotags` cannot handle this container (notably AIFF). Fall back to a
        // direct ID3 read, then to filename-derived values.
        Err(_) => match read_id3(path_ref) {
            Some(id3_meta) => ExtractedMetadata {
                title: if id3_meta.title.is_empty() {
                    fallback_title
                } else {
                    id3_meta.title
                },
                artist: if id3_meta.artist.is_empty() {
                    "Unknown Artist".to_string()
                } else {
                    id3_meta.artist
                },
                album: id3_meta.album,
                genre: id3_meta.genre,
                year: id3_meta.year,
                duration_ms: crate::container_duration_ms(path_ref).unwrap_or(0),
                format: extension,
                file_size,
                bpm: None,
                key_camelot: None,
                key_classical: None,
                rating: None,
                comments: None,
                artwork: None,
            },
            None => fallback(crate::container_duration_ms(path_ref).unwrap_or(0)),
        },
    };

    // Tags beyond what `audiotags` exposes (BPM, key, rating, comment, cover art)
    // are read once here, by container, and merged into the base record.
    apply_extra_tags(&mut meta, path_ref);

    Ok(meta)
}

/// Best-effort extras that `audiotags` does not surface.
#[derive(Debug, Default, Clone)]
struct ExtraTags {
    bpm: Option<f64>,
    /// Raw key string as written in the tag, e.g. `8A`, `Am`, `A minor`.
    key_raw: Option<String>,
    rating: Option<i64>,
    comments: Option<String>,
    artwork: Option<EmbeddedArtwork>,
}

impl ExtraTags {
    fn is_empty(&self) -> bool {
        self.bpm.is_none()
            && self.key_raw.is_none()
            && self.rating.is_none()
            && self.comments.is_none()
            && self.artwork.is_none()
    }
}

/// Reads the extra tags for `path` by container and merges them into `meta`.
///
/// This is deliberately separate from the primary `audiotags` read: it runs for
/// every importable file regardless of which branch above produced the base
/// metadata, and it never fails the import — a file whose extras cannot be read
/// simply keeps `None` values.
fn apply_extra_tags(meta: &mut ExtractedMetadata, path: &Path) {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or_default()
        .to_lowercase();

    let extra = match ext.as_str() {
        "mp3" | "wav" | "aif" | "aiff" | "aifc" => read_id3_extras(path),
        "flac" => read_flac_extras(path),
        _ => ExtraTags::default(),
    };

    merge_extras(meta, extra);
}

fn merge_extras(meta: &mut ExtractedMetadata, extra: ExtraTags) {
    if extra.is_empty() {
        return;
    }

    meta.bpm = extra.bpm;
    meta.rating = extra.rating;
    meta.comments = extra.comments;
    meta.artwork = extra.artwork;

    if let Some(raw) = extra.key_raw {
        match normalize_camelot(&raw) {
            // The tag already held a Camelot code.
            Some(camelot) => meta.key_camelot = Some(camelot),
            None => {
                // Otherwise keep the human-readable key and try to map it.
                meta.key_camelot = camelot_from_key(&raw);
                meta.key_classical = Some(raw);
            }
        }
    }
}

/// Extracts extras from an ID3 tag (MP3 / WAV / AIFF).
fn read_id3_extras(path: &Path) -> ExtraTags {
    let Ok(tag) = id3::Tag::read_from_path(path) else {
        return ExtraTags::default();
    };
    id3_extras(&tag)
}

fn id3_extras(tag: &id3::Tag) -> ExtraTags {
    // Artwork: prefer the front cover, otherwise the first embedded picture.
    let mut front: Option<EmbeddedArtwork> = None;
    let mut fallback: Option<EmbeddedArtwork> = None;
    for pic in tag.pictures() {
        if pic.data.is_empty() {
            continue;
        }
        let art = EmbeddedArtwork {
            mime_type: if pic.mime_type.trim().is_empty() {
                "image/jpeg".to_string()
            } else {
                pic.mime_type.clone()
            },
            data: pic.data.clone(),
        };
        if pic.picture_type == Id3PictureType::CoverFront {
            front = Some(art);
            break;
        }
        if fallback.is_none() {
            fallback = Some(art);
        }
    }

    ExtraTags {
        // BPM: `TBPM`, then the common `TXXX:BPM` / `TXXX:TEMPO` variants.
        bpm: text_frame(tag, "TBPM")
            .or_else(|| extended_text_frame(tag, &["bpm", "tempo"]))
            .as_deref()
            .and_then(parse_bpm),
        // Key: `TKEY`, then `TXXX:initialkey` / `TXXX:key`.
        key_raw: text_frame(tag, "TKEY")
            .or_else(|| extended_text_frame(tag, &["initialkey", "initial key", "key"])),
        // Rating: `POPM` (1–255) then `TXXX:rating`.
        rating: tag
            .get("POPM")
            .and_then(|frame| frame.content().popularimeter())
            .and_then(|popm| rating_from_popm(popm.rating))
            .or_else(|| {
                extended_text_frame(tag, &["rating"])
                    .as_deref()
                    .and_then(parse_rating_text)
            }),
        // Comment: first non-empty `COMM` frame.
        comments: tag
            .comments()
            .map(|c| c.text.trim())
            .find(|text| !text.is_empty())
            .map(str::to_string),
        artwork: front.or(fallback),
    }
}

fn text_frame(tag: &id3::Tag, id: &str) -> Option<String> {
    tag.get(id)
        .and_then(|frame| frame.content().text())
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .map(str::to_string)
}

fn extended_text_frame(tag: &id3::Tag, descriptions: &[&str]) -> Option<String> {
    tag.extended_texts()
        .find(|ext| {
            descriptions
                .iter()
                .any(|want| ext.description.eq_ignore_ascii_case(want))
        })
        .map(|ext| ext.value.trim().to_string())
        .filter(|v| !v.is_empty())
}

/// Extracts extras from a FLAC file's Vorbis comments and picture blocks.
fn read_flac_extras(path: &Path) -> ExtraTags {
    let Ok(tag) = metaflac::Tag::read_from_path(path) else {
        return ExtraTags::default();
    };

    let mut extra = ExtraTags::default();

    let first = |keys: &[&str]| -> Option<String> {
        for key in keys {
            if let Some(value) = tag.get_vorbis(key).and_then(|mut it| it.next()) {
                let trimmed = value.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
        }
        None
    };

    extra.bpm = first(&["BPM", "TEMPO"]).as_deref().and_then(parse_bpm);
    extra.key_raw = first(&["INITIALKEY", "KEY"]);
    extra.rating = first(&["RATING"]).as_deref().and_then(parse_rating_text);
    extra.comments = first(&["COMMENT", "DESCRIPTION", "COMMENTS"]);

    let mut fallback: Option<EmbeddedArtwork> = None;
    for pic in tag.pictures() {
        if pic.data.is_empty() {
            continue;
        }
        let art = EmbeddedArtwork {
            mime_type: if pic.mime_type.trim().is_empty() {
                "image/jpeg".to_string()
            } else {
                pic.mime_type.clone()
            },
            data: pic.data.clone(),
        };
        if pic.picture_type == metaflac::block::PictureType::CoverFront {
            extra.artwork = Some(art);
            break;
        }
        if fallback.is_none() {
            fallback = Some(art);
        }
    }
    if extra.artwork.is_none() {
        extra.artwork = fallback;
    }

    extra
}

/// Parses a BPM value, tolerating values like `128`, `128.00` or `128 BPM`.
fn parse_bpm(raw: &str) -> Option<f64> {
    let numeric: String = raw
        .trim()
        .chars()
        .take_while(|c| c.is_ascii_digit() || *c == '.')
        .collect();
    let bpm: f64 = numeric.parse().ok()?;
    (bpm.is_finite() && (1.0..=1000.0).contains(&bpm)).then_some(bpm)
}

/// Maps a `POPM` rating (0–255) onto 0–5 stars. `0` means "unknown".
fn rating_from_popm(raw: u8) -> Option<i64> {
    if raw == 0 {
        return None;
    }
    let stars = (f64::from(raw) / 255.0 * 5.0).round() as i64;
    Some(stars.clamp(1, 5))
}

/// Parses a textual rating. Accepts 0–5 stars, 0–100 (percent) or 0–255.
fn parse_rating_text(raw: &str) -> Option<i64> {
    let value: f64 = raw.trim().parse().ok()?;
    if !value.is_finite() || value <= 0.0 {
        return None;
    }
    let stars = if value <= 5.0 {
        value.round()
    } else if value <= 100.0 {
        (value / 20.0).round()
    } else {
        (value / 255.0 * 5.0).round()
    };
    Some((stars as i64).clamp(1, 5))
}

/// Uppercases a Camelot code like `8a` → `8A`; `None` if `raw` is not one.
fn normalize_camelot(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    let (digits, letter) = trimmed.split_at(trimmed.len().saturating_sub(1));
    let letter = letter.to_ascii_uppercase();
    if digits.is_empty() || !(letter == "A" || letter == "B") {
        return None;
    }
    let number: u8 = digits.parse().ok()?;
    (1..=12)
        .contains(&number)
        .then(|| format!("{number}{letter}"))
}

/// Maps a classical key name (e.g. `A minor`, `Am`, `F# Major`) to a Camelot
/// code. Returns `None` for keys it cannot confidently identify.
pub fn camelot_from_key(key: &str) -> Option<String> {
    let cleaned = key
        .trim()
        .to_ascii_lowercase()
        .replace('♯', "#")
        .replace('♭', "b")
        .replace("major", "maj")
        .replace("minor", "min")
        .replace(" ", "");

    let (root, is_minor) = if let Some(root) = cleaned.strip_suffix("min") {
        (root, true)
    } else if let Some(root) = cleaned.strip_suffix("maj") {
        (root, false)
    } else if let Some(root) = cleaned.strip_suffix('m') {
        // `Am`, `C#m` — but not `Dm`-less names that never occur.
        (root, true)
    } else {
        (cleaned.as_str(), false)
    };

    // Camelot: 8B = C major, 8A = A minor; numbers ascend by fifths.
    let major = [
        ("c", "8B"),
        ("g", "9B"),
        ("d", "10B"),
        ("a", "11B"),
        ("e", "12B"),
        ("b", "1B"),
        ("f#", "2B"),
        ("c#", "3B"),
        ("g#", "4B"),
        ("d#", "5B"),
        ("a#", "6B"),
        ("f", "7B"),
    ];
    let minor = [
        ("a", "8A"),
        ("e", "9A"),
        ("b", "10A"),
        ("f#", "11A"),
        ("c#", "12A"),
        ("g#", "1A"),
        ("d#", "2A"),
        ("a#", "3A"),
        ("f", "4A"),
        ("c", "5A"),
        ("g", "6A"),
        ("d", "7A"),
    ];

    let table = if is_minor { &minor } else { &major };
    table
        .iter()
        .find(|(name, _)| *name == root)
        .map(|(_, code)| (*code).to_string())
}

/// Writes embedded artwork into `cache_dir` under a content-addressed filename.
///
/// The hash is the BLAKE3 digest of the image bytes, so identical artwork from
/// different tracks collapses to one cache file and survives rescans.
pub fn cache_artwork(artwork: &EmbeddedArtwork, cache_dir: &Path) -> Result<CachedArtwork, String> {
    if artwork.data.is_empty() {
        return Err("artwork has no data".to_string());
    }

    let hash = blake3::hash(&artwork.data).to_hex().to_string();
    let extension = match artwork.mime_type.to_ascii_lowercase().as_str() {
        "image/jpeg" | "image/jpg" | "jpeg" | "jpg" => "jpg",
        "image/png" | "png" => "png",
        "image/gif" | "gif" => "gif",
        "image/webp" | "webp" => "webp",
        "image/bmp" | "bmp" => "bmp",
        _ => "img",
    };

    std::fs::create_dir_all(cache_dir)
        .map_err(|e| format!("cannot create artwork cache dir: {e}"))?;

    let path = cache_dir.join(format!("{hash}.{extension}"));
    if !path.exists() {
        std::fs::write(&path, &artwork.data)
            .map_err(|e| format!("cannot write cached artwork: {e}"))?;
    }

    Ok(CachedArtwork {
        hash,
        path,
        mime_type: artwork.mime_type.clone(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;

    fn temp_file(name: &str, contents: &[u8]) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join("dj-assistant-metadata-tests");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(name);
        let mut f = File::create(&path).unwrap();
        f.write_all(contents).unwrap();
        path
    }

    #[test]
    fn unparseable_file_falls_back_to_filename_stem() {
        // A .flac that is not actually FLAC must not error the scan; it falls back.
        let path = temp_file("My Great Track (Extended Mix).flac", b"not really flac");
        let meta = extract_metadata(&path).unwrap();

        assert_eq!(meta.title, "My Great Track (Extended Mix)");
        assert_eq!(meta.artist, "Unknown Artist");
        assert_eq!(meta.album, None);
        assert_eq!(meta.genre, None);
        assert_eq!(meta.year, None);
        assert_eq!(meta.format, "flac");
        assert_eq!(meta.duration_ms, 0);
        assert_eq!(meta.file_size, 15); // len("not really flac")

        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn format_is_lowercased_extension() {
        let path = temp_file("UPPER.FLAC", b"x");
        assert_eq!(extract_metadata(&path).unwrap().format, "flac");
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn missing_extension_is_reported_as_unknown() {
        let path = temp_file("noextension", b"x");
        let meta = extract_metadata(&path).unwrap();
        assert_eq!(meta.format, "unknown");
        assert_eq!(meta.title, "noextension");
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn missing_file_is_an_error() {
        let missing = std::env::temp_dir().join("dj-assistant-nope-xyz.flac");
        let _ = std::fs::remove_file(&missing);
        assert!(extract_metadata(&missing).is_err());
    }

    /// Builds a file whose only content is an ID3v2.4 tag carrying every extra.
    fn id3_tagged_file(name: &str) -> std::path::PathBuf {
        use id3::frame::{Comment, Picture, PictureType, Popularimeter};
        use id3::Version;

        let path = temp_file(name, b"");
        let mut tag = id3::Tag::new();
        tag.set_title("Tagged Title");
        tag.set_artist("Tagged Artist");
        tag.set_text("TBPM", "128");
        tag.set_text("TKEY", "A minor");
        tag.add_frame(Comment {
            lang: "eng".to_string(),
            description: String::new(),
            text: "Peak time weapon".to_string(),
        });
        tag.add_frame(Popularimeter {
            user: "dj@example.com".to_string(),
            // Windows Media's 4-star value.
            rating: 196,
            counter: 0,
        });
        tag.add_frame(Picture {
            mime_type: "image/png".to_string(),
            picture_type: PictureType::CoverFront,
            description: "cover".to_string(),
            data: vec![0x89, 0x50, 0x4E, 0x47],
        });
        tag.write_to_path(&path, Version::Id3v24).unwrap();
        path
    }

    #[test]
    fn id3_extras_are_extracted_from_tags() {
        let path = id3_tagged_file("extras.mp3");
        let meta = extract_metadata(&path).unwrap();

        assert_eq!(meta.title, "Tagged Title");
        assert_eq!(meta.artist, "Tagged Artist");
        assert_eq!(meta.bpm, Some(128.0), "TBPM must be read");
        assert_eq!(meta.key_classical.as_deref(), Some("A minor"));
        assert_eq!(meta.key_camelot.as_deref(), Some("8A"), "mapped to Camelot");
        assert_eq!(meta.rating, Some(4), "POPM 196 maps to 4 stars");
        assert_eq!(meta.comments.as_deref(), Some("Peak time weapon"));
        let art = meta.artwork.expect("APIC must be extracted");
        assert_eq!(art.mime_type, "image/png");
        assert_eq!(art.data, vec![0x89, 0x50, 0x4E, 0x47]);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn id3_extras_absent_when_tags_absent() {
        // A plain, tag-free file must not fabricate extras.
        let path = temp_file("no-extras.flac", b"not really flac");
        let meta = extract_metadata(&path).unwrap();
        assert_eq!(meta.bpm, None);
        assert_eq!(meta.key_camelot, None);
        assert_eq!(meta.key_classical, None);
        assert_eq!(meta.rating, None);
        assert_eq!(meta.comments, None);
        assert!(meta.artwork.is_none());
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn flac_vorbis_extras_are_extracted() {
        let path = temp_file("vorbis-extras.flac", b"");
        let mut tag = metaflac::Tag::new();
        tag.set_vorbis("BPM", vec!["140"]);
        tag.set_vorbis("INITIALKEY", vec!["8A"]);
        tag.set_vorbis("COMMENT", vec!["rolling deep"]);
        tag.set_vorbis("RATING", vec!["80"]);
        tag.add_picture(
            "image/jpeg",
            metaflac::block::PictureType::CoverFront,
            vec![0xFF, 0xD8, 0xFF],
        );
        tag.write_to_path(&path).unwrap();

        let meta = extract_metadata(&path).unwrap();
        assert_eq!(meta.bpm, Some(140.0));
        assert_eq!(meta.key_camelot.as_deref(), Some("8A"));
        assert_eq!(
            meta.key_classical, None,
            "an existing Camelot code is not a classical key"
        );
        assert_eq!(meta.rating, Some(4), "RATING 80/100 maps to 4 stars");
        assert_eq!(meta.comments.as_deref(), Some("rolling deep"));
        assert_eq!(
            meta.artwork.map(|a| a.mime_type),
            Some("image/jpeg".to_string())
        );
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn bpm_parsing_tolerates_units_and_rejects_garbage() {
        assert_eq!(parse_bpm("128"), Some(128.0));
        assert_eq!(parse_bpm("128.50"), Some(128.5));
        assert_eq!(parse_bpm(" 174 BPM "), Some(174.0));
        assert_eq!(parse_bpm(""), None);
        assert_eq!(parse_bpm("fast"), None);
        assert_eq!(parse_bpm("0"), None, "zero is not a BPM");
    }

    #[test]
    fn rating_mapping_handles_popm_and_text_scales() {
        assert_eq!(rating_from_popm(0), None, "0 means unknown");
        assert_eq!(rating_from_popm(255), Some(5));
        assert_eq!(rating_from_popm(1), Some(1));
        assert_eq!(rating_from_popm(128), Some(3));
        assert_eq!(parse_rating_text("5"), Some(5));
        assert_eq!(parse_rating_text("80"), Some(4));
        assert_eq!(parse_rating_text("196"), Some(4));
        assert_eq!(parse_rating_text("0"), None);
        assert_eq!(parse_rating_text("nope"), None);
    }

    #[test]
    fn camelot_mapping_covers_major_minor_and_existing_codes() {
        assert_eq!(camelot_from_key("A minor").as_deref(), Some("8A"));
        assert_eq!(camelot_from_key("Am").as_deref(), Some("8A"));
        assert_eq!(camelot_from_key("C major").as_deref(), Some("8B"));
        assert_eq!(camelot_from_key("F#m").as_deref(), Some("11A"));
        assert_eq!(camelot_from_key("unparseable"), None);
        // Tags that already carry a Camelot code are normalised, not remapped.
        assert_eq!(normalize_camelot("8a").as_deref(), Some("8A"));
        assert_eq!(normalize_camelot("12B").as_deref(), Some("12B"));
        assert_eq!(normalize_camelot("13A"), None);
        assert_eq!(normalize_camelot("8C"), None);
    }

    #[test]
    fn artwork_is_cached_under_a_stable_content_hash() {
        let dir = std::env::temp_dir().join("dj-assistant-artwork-cache-tests");
        let _ = std::fs::remove_dir_all(&dir);

        let art = EmbeddedArtwork {
            mime_type: "image/png".to_string(),
            data: vec![1, 2, 3, 4, 5],
        };

        let first = cache_artwork(&art, &dir).unwrap();
        assert!(first.path.exists(), "cached file must exist");
        assert_eq!(first.path.extension().unwrap(), "png");
        assert_eq!(std::fs::read(&first.path).unwrap(), art.data);

        // Same bytes -> same hash -> no new file, even with different MIME casing.
        let second = cache_artwork(&art, &dir).unwrap();
        assert_eq!(first.hash, second.hash);
        assert_eq!(first.path, second.path);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn zero_byte_file_is_importable_with_fallbacks() {
        // Corrupt-fixture case: an empty file must not crash extraction.
        let path = temp_file("zero-bytes.flac", b"");
        let meta = extract_metadata(&path).unwrap();
        assert_eq!(meta.title, "zero-bytes");
        assert_eq!(meta.file_size, 0);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn utf8_filename_survives_fallback() {
        let path = temp_file("Ünïcodé Ärtîst – Trâck (Extended Mix).wav", b"x");
        let meta = extract_metadata(&path).unwrap();
        assert_eq!(meta.title, "Ünïcodé Ärtîst – Trâck (Extended Mix)");
        let _ = std::fs::remove_file(path);
    }
}
