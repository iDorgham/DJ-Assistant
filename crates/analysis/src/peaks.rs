//! Peak binning for the waveform layers (T2.4.1).
//!
//! The player renders two layers from the same decode: a zoomed detail view
//! and a full-track overview rail. The T2.4.2 contract pins that each layer
//! keeps *its own* peak buffer — never one shared array — so the overview is
//! binned at a coarser, rail-appropriate resolution instead of being
//! decimated at draw time from the detail buffer.

/// Bin count for the zoomed detail waveform (T2.4.1 historical value).
pub const DETAIL_BINS: usize = 4000;
/// Bin count for the full-track overview rail: two to three times wider than
/// any realistic window and drawn at a 2px step, so finer bins are pixels the
/// rail never shows.
pub const OVERVIEW_BINS: usize = 1000;

/// Max-|sample| peak list of `mono` into `bins` proportional bins.
///
/// Bin `i` owns `[i * frames / bins, (i + 1) * frames / bins)`. A fixed
/// `frames.div_ceil(bins)` stride stops short of `frames` when the stride does
/// not divide it evenly, which left the tail bins at zero and cut the waveform
/// before the real duration. Proportional edges cover every frame and keep
/// every bin non-empty while `frames >= bins`; below that the empty bins are
/// legitimately zero.
pub fn peak_bins(mono: &[f32], bins: usize) -> Vec<f32> {
    let mut peaks = vec![0.0f32; bins];
    if bins == 0 {
        return peaks;
    }
    let frames = mono.len();
    for (i, peak) in peaks.iter_mut().enumerate() {
        let start = (i as u128 * frames as u128 / bins as u128) as usize;
        let end = ((i as u128 + 1) * frames as u128 / bins as u128) as usize;
        let mut max_abs: f32 = 0.0;
        for sample in &mono[start..end] {
            let a = sample.abs();
            if a > max_abs {
                max_abs = a;
            }
        }
        *peak = max_abs;
    }
    peaks
}

/// The two cached peak resolutions of one decode (T2.4.1).
#[derive(Debug, Clone, PartialEq)]
pub struct PeakLayers {
    pub detail: Vec<f32>,
    pub overview: Vec<f32>,
}

/// Bin one mono decode into both waveform layers, each in its own buffer.
pub fn peak_layers(mono: &[f32]) -> PeakLayers {
    PeakLayers {
        detail: peak_bins(mono, DETAIL_BINS),
        overview: peak_bins(mono, OVERVIEW_BINS),
    }
}

#[cfg(test)]
mod tests {
    use super::{peak_bins, peak_layers, DETAIL_BINS, OVERVIEW_BINS};

    #[test]
    fn peak_bins_keeps_the_max_absolute_value_per_bin() {
        let mono = [0.2, -0.9, 0.4, 0.1];
        assert_eq!(peak_bins(&mono, 2), vec![0.9, 0.4]);
    }

    #[test]
    fn peak_bins_covers_the_tail_when_frames_do_not_divide_evenly() {
        // 4001 frames across 4000 bins: a fixed div_ceil stride stopped short of
        // `frames` and left the last bin zero, cutting the waveform before the
        // real duration. Proportional edges must include the final sample.
        let mut mono = vec![0.0f32; 4001];
        mono[4000] = 0.5;
        let peaks = peak_bins(&mono, 4000);
        assert_eq!(peaks.len(), 4000);
        assert_eq!(peaks[3999], 0.5);
    }

    #[test]
    fn peak_bins_leaves_empty_bins_zero_when_frames_below_bins() {
        // Below one frame per bin most bins are legitimately zero, and the
        // proportional edges put the lone frame in the last bin whose span
        // reaches frame 0 .. 1 — the same convention the detail bins use.
        assert_eq!(peak_bins(&[0.7], 4), vec![0.0, 0.0, 0.0, 0.7]);
        assert_eq!(peak_bins(&[], 4), vec![0.0, 0.0, 0.0, 0.0]);
    }

    #[test]
    fn peak_bins_with_zero_bins_returns_empty() {
        assert_eq!(peak_bins(&[0.5], 0), Vec::<f32>::new());
    }

    #[test]
    fn peak_layers_keeps_detail_and_overview_as_separate_buffers() {
        let mut mono = vec![0.0f32; 8000];
        mono[7000] = 0.6;
        let layers = peak_layers(&mono);
        assert_eq!(layers.detail.len(), DETAIL_BINS);
        assert_eq!(layers.overview.len(), OVERVIEW_BINS);
        // Distinct resolutions, not one aliased buffer: the spike lands at the
        // same time position but in different indices in each layer.
        assert_eq!(layers.detail[3500], 0.6);
        assert_eq!(layers.overview[875], 0.6);
        assert_eq!(layers.detail[3501], 0.0);
        assert_eq!(layers.overview[876], 0.0);
    }
}
