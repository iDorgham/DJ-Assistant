//! Audio normalization and DSP utilities.
//!
//! Provides channel downmixing/upmixing, arbitrary sample rate conversion (resampling),
//! peak normalization, and RMS normalization for preparing raw audio for machine learning models.

use crate::decoder::DecodedAudio;
use crate::error::NormalizationError;

/// Downmixes multi-channel interleaved audio to a single mono channel.
pub fn to_mono(interleaved: &[f32], channels: usize) -> Result<Vec<f32>, NormalizationError> {
    if channels == 0 {
        return Err(NormalizationError::InvalidChannels(0));
    }
    if interleaved.is_empty() {
        return Ok(Vec::new());
    }
    if channels == 1 {
        return Ok(interleaved.to_vec());
    }

    let frames = interleaved.len() / channels;
    let mut mono = Vec::with_capacity(frames);
    let ch_inv = 1.0f32 / (channels as f32);

    for frame in interleaved.chunks_exact(channels) {
        let sum: f32 = frame.iter().sum();
        mono.push(sum * ch_inv);
    }

    Ok(mono)
}

/// Converts audio to interleaved stereo (2 channels).
pub fn to_stereo(samples: &[f32], channels: usize) -> Result<Vec<f32>, NormalizationError> {
    if channels == 0 {
        return Err(NormalizationError::InvalidChannels(0));
    }
    if samples.is_empty() {
        return Ok(Vec::new());
    }
    if channels == 2 {
        return Ok(samples.to_vec());
    }

    if channels == 1 {
        let mut stereo = Vec::with_capacity(samples.len() * 2);
        for &s in samples {
            stereo.push(s);
            stereo.push(s);
        }
        return Ok(stereo);
    }

    // Downmix multi-channel (>2) to stereo (channels 0 & 1)
    let frames = samples.len() / channels;
    let mut stereo = Vec::with_capacity(frames * 2);
    for frame in samples.chunks_exact(channels) {
        stereo.push(frame[0]);
        stereo.push(frame[1]);
    }

    Ok(stereo)
}

/// Resamples a single-channel (mono) audio buffer from `source_rate` to `target_rate`
/// using linear interpolation.
pub fn resample(
    samples: &[f32],
    source_rate: u32,
    target_rate: u32,
) -> Result<Vec<f32>, NormalizationError> {
    if source_rate == 0 || target_rate == 0 {
        return Err(NormalizationError::InvalidSampleRate {
            source_rate,
            target_rate,
        });
    }
    if samples.is_empty() {
        return Ok(Vec::new());
    }
    if source_rate == target_rate {
        return Ok(samples.to_vec());
    }

    let ratio = (source_rate as f64) / (target_rate as f64);
    let out_len = ((samples.len() as f64) / ratio).round() as usize;
    if out_len == 0 {
        return Ok(Vec::new());
    }

    let mut output = Vec::with_capacity(out_len);
    let in_len = samples.len();

    for i in 0..out_len {
        let pos = (i as f64) * ratio;
        let idx = pos.floor() as usize;
        let frac = (pos - (idx as f64)) as f32;

        if idx >= in_len {
            break;
        }

        let s0 = samples[idx];
        let s1 = if idx + 1 < in_len {
            samples[idx + 1]
        } else {
            s0
        };

        output.push(s0 * (1.0 - frac) + s1 * frac);
    }

    Ok(output)
}

/// Peak-normalizes samples in-place so that `max(|sample|) == target_peak`.
/// Returns the gain factor applied.
pub fn peak_normalize(samples: &mut [f32], target_peak: f32) -> Result<f32, NormalizationError> {
    if !target_peak.is_finite() || target_peak <= 0.0 {
        return Err(NormalizationError::InvalidTargetPeak(target_peak));
    }
    if samples.is_empty() {
        return Err(NormalizationError::EmptyBuffer);
    }

    let max_abs = samples.iter().map(|s| s.abs()).fold(0.0f32, f32::max);

    if max_abs < 1e-7 {
        // Audio is virtually silent; do not apply huge division gain
        return Ok(1.0);
    }

    let gain = target_peak / max_abs;
    for s in samples.iter_mut() {
        *s *= gain;
    }

    Ok(gain)
}

/// RMS-normalizes samples in-place so that `sqrt(mean(x^2)) == target_rms`.
/// Returns the gain factor applied.
pub fn rms_normalize(samples: &mut [f32], target_rms: f32) -> Result<f32, NormalizationError> {
    if !target_rms.is_finite() || target_rms <= 0.0 {
        return Err(NormalizationError::InvalidTargetRms(target_rms));
    }
    if samples.is_empty() {
        return Err(NormalizationError::EmptyBuffer);
    }

    let sum_sq: f64 = samples.iter().map(|&s| (s as f64) * (s as f64)).sum();
    let mean_sq = sum_sq / (samples.len() as f64);
    let rms = mean_sq.sqrt() as f32;

    if rms < 1e-7 {
        return Ok(1.0);
    }

    let gain = target_rms / rms;
    for s in samples.iter_mut() {
        *s *= gain;
    }

    Ok(gain)
}

/// Convenience pipeline to prepare decoded audio for an inference model:
/// 1. Downmixes to mono.
/// 2. Resamples to `target_rate` (e.g. 22050 or 44100).
/// 3. Optionally applies peak normalization (e.g. `Some(1.0)` or `Some(0.95)`).
pub fn prepare_for_model(
    decoded: &DecodedAudio,
    target_rate: u32,
    target_peak: Option<f32>,
) -> Result<Vec<f32>, NormalizationError> {
    let mono = to_mono(&decoded.samples, decoded.channels)?;
    let mut resampled = resample(&mono, decoded.sample_rate, target_rate)?;

    if let Some(peak) = target_peak {
        let _ = peak_normalize(&mut resampled, peak)?;
    }

    Ok(resampled)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn to_mono_averages_stereo_correctly() {
        let stereo = vec![1.0, 0.0, 0.5, 0.5, -0.2, 0.8];
        let mono = to_mono(&stereo, 2).expect("Should downmix");
        assert_eq!(mono, vec![0.5, 0.5, 0.3]);
    }

    #[test]
    fn to_stereo_duplicates_mono() {
        let mono = vec![0.1, 0.5, -0.3];
        let stereo = to_stereo(&mono, 1).expect("Should upmix");
        assert_eq!(stereo, vec![0.1, 0.1, 0.5, 0.5, -0.3, -0.3]);
    }

    #[test]
    fn resample_preserves_length_at_same_rate() {
        let input = vec![0.1, 0.2, 0.3, 0.4];
        let output = resample(&input, 44100, 44100).expect("Should resample");
        assert_eq!(input, output);
    }

    #[test]
    fn resample_downsamples_to_half_rate() {
        let input = vec![0.0, 0.5, 1.0, 0.5, 0.0, -0.5, -1.0, -0.5];
        let output = resample(&input, 44100, 22050).expect("Should downsample");
        assert_eq!(output.len(), 4);
    }

    #[test]
    fn peak_normalize_scales_to_target() {
        let mut samples = vec![0.1, -0.4, 0.5, -0.2];
        let gain = peak_normalize(&mut samples, 1.0).expect("Should normalize");
        assert!((gain - 2.0).abs() < 1e-5);
        let max_abs = samples.iter().map(|s| s.abs()).fold(0.0f32, f32::max);
        assert!((max_abs - 1.0).abs() < 1e-5);
    }

    #[test]
    fn rms_normalize_scales_correctly() {
        let mut samples = vec![0.5, -0.5, 0.5, -0.5];
        let gain = rms_normalize(&mut samples, 1.0).expect("Should normalize");
        assert!((gain - 2.0).abs() < 1e-5);
    }

    #[test]
    fn rejects_invalid_parameters() {
        assert!(matches!(
            to_mono(&[1.0], 0),
            Err(NormalizationError::InvalidChannels(0))
        ));
        assert!(matches!(
            resample(&[1.0], 0, 44100),
            Err(NormalizationError::InvalidSampleRate { .. })
        ));
        assert!(matches!(
            peak_normalize(&mut [1.0], -1.0),
            Err(NormalizationError::InvalidTargetPeak(_))
        ));
    }
}
