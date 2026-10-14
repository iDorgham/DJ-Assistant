//! Local similar-track scoring.
//!
//! Finds tracks that mix well with a seed track using only data already in the
//! library database: BPM, Camelot key, genre and duration. No network access,
//! no audio reads — this is the offline half of the "find similar tracks"
//! feature. External similarity (Last.fm / provider recommendations) will reuse
//! the same `ScoredTrack` shape with a `source` attached at the IPC layer.
//!
//! Scoring is a renormalised weighted sum over the signals both tracks have:
//!
//! | Signal   | Weight | Full score when |
//! |----------|--------|-----------------|
//! | BPM      | 0.45   | identical tempo |
//! | Key      | 0.35   | same Camelot code |
//! | Genre    | 0.10   | same genre string (case-insensitive) |
//! | Duration | 0.10   | identical length |
//!
//! Signals missing on either side are skipped and the remaining weights are
//! renormalised, so a track with no BPM is not punished — it simply contributes
//! fewer reasons. A pair with no shared signals scores `0.0`.

/// Features needed to score one track. Mirrors the `tracks` table columns used
/// by the `find_similar_tracks` IPC command.
#[derive(Debug, Clone, PartialEq)]
pub struct TrackFeatures {
    pub id: String,
    pub bpm: Option<f64>,
    pub key_camelot: Option<String>,
    pub genre: Option<String>,
    pub duration_ms: i64,
}

/// A candidate ranked against a seed track.
#[derive(Debug, Clone, PartialEq)]
pub struct ScoredTrack {
    pub track_id: String,
    /// Blended similarity in `0.0..=1.0`.
    pub score: f64,
    /// Human-readable chips for the UI, e.g. `"same key 8A"`, `"+1.2% BPM"`.
    pub reasons: Vec<String>,
}

/// Parses a Camelot code like `8A` into `(number 1-12, minor: bool)`.
fn parse_camelot(raw: &str) -> Option<(u8, bool)> {
    let trimmed = raw.trim().to_ascii_uppercase();
    if trimmed.len() < 2 {
        return None;
    }
    if !trimmed.is_ascii() {
        return None;
    }
    let (digits, letter) = trimmed.split_at(trimmed.len() - 1);
    let number: u8 = digits.parse().ok()?;
    if !(1..=12).contains(&number) {
        return None;
    }
    match letter {
        "A" => Some((number, true)),
        "B" => Some((number, false)),
        _ => None,
    }
}

/// Musical distance between two Camelot codes, in `0..=6`.
///
/// - `0` — identical code.
/// - `1` — adjacent (same letter, neighbouring number) or relative
///   major/minor (same number, other letter).
/// - `2` — diagonal (neighbouring number *and* other letter).
/// - Otherwise the circular number distance plus a letter mismatch penalty,
///   capped at 6.
///
/// Returns `None` when either code is unparseable.
pub fn camelot_distance(a: &str, b: &str) -> Option<u8> {
    let (num_a, minor_a) = parse_camelot(a)?;
    let (num_b, minor_b) = parse_camelot(b)?;

    if num_a == num_b {
        return Some(if minor_a == minor_b { 0 } else { 1 });
    }

    let clockwise = (i16::from(num_b) - i16::from(num_a)).rem_euclid(12);
    let steps = clockwise.min(12 - clockwise);
    let letter_penalty = i16::from(minor_a != minor_b);
    let dist = if steps <= 1 {
        // Adjacent numbers: 1 same-letter, 2 diagonal.
        steps + letter_penalty
    } else {
        steps + letter_penalty
    };
    Some(dist.min(6) as u8)
}

/// Tempo similarity in `0.0..=1.0`: full marks for identical BPM, decaying to
/// zero at an 8% relative difference (beyond a mixable pitch-fader range).
///
/// Returns `None` when either tempo is missing or non-positive.
pub fn bpm_similarity(a: Option<f64>, b: Option<f64>) -> Option<f64> {
    let (a, b) = (a?, b?);
    if !a.is_finite() || !b.is_finite() || a <= 0.0 || b <= 0.0 {
        return None;
    }
    let diff = (a - b).abs() / a.max(b);
    Some((1.0 - diff / 0.08).clamp(0.0, 1.0))
}

fn genre_match(a: Option<&str>, b: Option<&str>) -> Option<bool> {
    let (a, b) = (a?, b?);
    let (a, b) = (a.trim(), b.trim());
    if a.is_empty() || b.is_empty() {
        return None;
    }
    Some(a.eq_ignore_ascii_case(b))
}

fn duration_similarity(a_ms: i64, b_ms: i64) -> Option<f64> {
    if a_ms <= 0 || b_ms <= 0 {
        return None;
    }
    let diff = (a_ms - b_ms).abs() as f64 / a_ms.max(b_ms) as f64;
    Some((1.0 - diff / 0.25).clamp(0.0, 1.0))
}

/// Scores one candidate against the seed, returning the blended score plus UI
/// reason chips. A pair with no comparable signals scores `0.0` with a single
/// `"no comparable data"` reason.
pub fn similarity_score(seed: &TrackFeatures, candidate: &TrackFeatures) -> (f64, Vec<String>) {
    let mut weighted = 0.0;
    let mut weight_sum = 0.0;
    let mut reasons: Vec<String> = Vec::new();

    if let Some(sim) = bpm_similarity(seed.bpm, candidate.bpm) {
        weighted += 0.45 * sim;
        weight_sum += 0.45;
        let pct = ((candidate.bpm.unwrap_or(0.0) - seed.bpm.unwrap_or(0.0)).abs()
            / seed.bpm.unwrap_or(1.0).max(0.01))
            * 100.0;
        if sim >= 0.99 {
            reasons.push("same BPM".to_string());
        } else if sim > 0.0 {
            reasons.push(format!("{pct:.1}% BPM apart"));
        }
    }

    if let (Some(a), Some(b)) = (
        seed.key_camelot.as_deref(),
        candidate.key_camelot.as_deref(),
    ) {
        if let Some(dist) = camelot_distance(a, b) {
            let sim = (1.0 - f64::from(dist) / 6.0).clamp(0.0, 1.0);
            weighted += 0.35 * sim;
            weight_sum += 0.35;
            let norm = b.trim().to_ascii_uppercase();
            if dist == 0 {
                reasons.push(format!("same key {norm}"));
            } else if dist <= 1 {
                reasons.push(format!("compatible key {norm}"));
            } else if dist == 2 {
                reasons.push(format!("energy-boost key {norm}"));
            }
        }
    }

    if let Some(matched) = genre_match(seed.genre.as_deref(), candidate.genre.as_deref()) {
        weighted += 0.10 * f64::from(matched);
        weight_sum += 0.10;
        if matched {
            if let Some(g) = candidate.genre.as_deref() {
                reasons.push(format!("same genre {}", g.trim()));
            }
        }
    }

    if let Some(sim) = duration_similarity(seed.duration_ms, candidate.duration_ms) {
        weighted += 0.10 * sim;
        weight_sum += 0.10;
        if sim >= 0.95 {
            reasons.push("similar length".to_string());
        }
    }

    if weight_sum == 0.0 {
        return (0.0, vec!["no comparable data".to_string()]);
    }
    (weighted / weight_sum, reasons)
}

/// Ranks `candidates` against `seed` (excluding the seed itself),
/// highest score first with a track-id tie-break for determinism.
pub fn find_similar(
    seed: &TrackFeatures,
    candidates: &[TrackFeatures],
    limit: usize,
) -> Vec<ScoredTrack> {
    let limit = limit.clamp(1, 50);
    let mut scored: Vec<ScoredTrack> = candidates
        .iter()
        .filter(|c| c.id != seed.id)
        .map(|c| {
            let (score, reasons) = similarity_score(seed, c);
            ScoredTrack {
                track_id: c.id.clone(),
                score,
                reasons,
            }
        })
        .collect();
    scored.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.track_id.cmp(&b.track_id))
    });
    scored.truncate(limit);
    scored
}

#[cfg(test)]
mod tests {
    use super::*;

    fn features(id: &str, bpm: Option<f64>, key: Option<&str>) -> TrackFeatures {
        TrackFeatures {
            id: id.to_string(),
            bpm,
            key_camelot: key.map(str::to_string),
            genre: Some("Techno".to_string()),
            duration_ms: 360_000,
        }
    }

    #[test]
    fn identical_tracks_score_one() {
        let seed = features("a", Some(128.0), Some("8A"));
        let (score, reasons) = similarity_score(&seed, &features("b", Some(128.0), Some("8A")));
        assert!((score - 1.0).abs() < 1e-9, "score was {score}");
        assert!(reasons.iter().any(|r| r.contains("same key 8A")));
        assert!(reasons.iter().any(|r| r.contains("same BPM")));
    }

    #[test]
    fn seed_is_excluded_and_order_is_deterministic() {
        let seed = features("seed", Some(128.0), Some("8A"));
        let cands = vec![
            features("seed", Some(128.0), Some("8A")),
            features("b", Some(128.0), Some("8A")),
            features("a", Some(128.0), Some("8A")),
        ];
        let ranked = find_similar(&seed, &cands, 10);
        assert_eq!(ranked.len(), 2);
        assert_eq!(ranked[0].track_id, "a");
        assert_eq!(ranked[1].track_id, "b");
    }

    #[test]
    fn camelot_distances_match_the_wheel() {
        assert_eq!(camelot_distance("8A", "8A"), Some(0));
        assert_eq!(camelot_distance("8a", "8A"), Some(0), "case-insensitive");
        assert_eq!(camelot_distance("8A", "9A"), Some(1), "adjacent");
        assert_eq!(
            camelot_distance("8A", "8B"),
            Some(1),
            "relative major/minor"
        );
        assert_eq!(
            camelot_distance("8A", "9B"),
            Some(2),
            "diagonal energy boost"
        );
        assert_eq!(camelot_distance("12A", "1A"), Some(1), "wraps around");
        assert_eq!(
            camelot_distance("8A", "2A"),
            Some(6),
            "opposite side caps at 6"
        );
        assert_eq!(camelot_distance("8A", "nope"), None);
        assert_eq!(camelot_distance("13A", "8A"), None);
        // Non-ASCII input must degrade to None, never panic on a byte split.
        assert_eq!(camelot_distance("é", "8A"), None);
        assert_eq!(camelot_distance("8A", "8Á"), None);
        assert_eq!(camelot_distance("日本語", "8A"), None);
    }

    #[test]
    fn bpm_similarity_decays_to_zero_at_eight_percent() {
        assert_eq!(bpm_similarity(Some(128.0), Some(128.0)), Some(1.0));
        let close = bpm_similarity(Some(128.0), Some(130.0)).unwrap();
        assert!(close > 0.7 && close < 1.0, "close tempo: {close}");
        assert_eq!(bpm_similarity(Some(100.0), Some(130.0)), Some(0.0));
        assert_eq!(bpm_similarity(None, Some(128.0)), None);
        assert_eq!(bpm_similarity(Some(0.0), Some(128.0)), None);
    }

    #[test]
    fn missing_signals_renormalise_instead_of_punishing() {
        let seed = features("a", None, None);
        let mut bare = features("b", None, None);
        bare.genre = None;
        bare.duration_ms = 0;
        let (score, reasons) = similarity_score(&seed, &bare);
        assert_eq!(score, 0.0);
        assert_eq!(reasons, vec!["no comparable data".to_string()]);

        // Same key alone still ranks highly even without BPM.
        let keyed = TrackFeatures {
            id: "c".to_string(),
            bpm: None,
            key_camelot: Some("8A".to_string()),
            genre: None,
            duration_ms: 0,
        };
        let seed_keyed = TrackFeatures {
            id: "a".to_string(),
            bpm: None,
            key_camelot: Some("8A".to_string()),
            genre: None,
            duration_ms: 0,
        };
        let (key_score, _) = similarity_score(&seed_keyed, &keyed);
        assert!((key_score - 1.0).abs() < 1e-9);
    }

    #[test]
    fn genre_comparison_is_case_insensitive() {
        let mut a = features("a", Some(128.0), Some("8A"));
        let mut b = features("b", Some(128.0), Some("8A"));
        a.genre = Some("techno".to_string());
        b.genre = Some("TECHNO".to_string());
        let (score, reasons) = similarity_score(&a, &b);
        assert!((score - 1.0).abs() < 1e-9);
        assert!(reasons.iter().any(|r| r.contains("same genre")));
    }

    #[test]
    fn limit_is_clamped() {
        let seed = features("seed", Some(128.0), Some("8A"));
        let cands: Vec<TrackFeatures> = (0..60)
            .map(|i| features(&format!("t{i:02}"), Some(128.0), Some("8A")))
            .collect();
        assert_eq!(find_similar(&seed, &cands, 500).len(), 50);
        assert_eq!(find_similar(&seed, &cands, 0).len(), 1);
    }

    #[test]
    fn far_tempo_and_key_rank_last() {
        let seed = features("seed", Some(128.0), Some("8A"));
        let close = features("close", Some(128.5), Some("9A"));
        let far = features("far", Some(90.0), Some("3B"));
        let ranked = find_similar(&seed, &[far, close], 10);
        assert_eq!(ranked[0].track_id, "close");
        assert_eq!(ranked[1].track_id, "far");
        assert!(ranked[0].score > ranked[1].score);
    }
}
