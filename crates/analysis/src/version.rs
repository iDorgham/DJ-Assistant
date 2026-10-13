//! Composite `analysis_version` computation (T1.1.8).
//!
//! Each analyzer stamps a `*_PIPELINE_VERSION` on its result. `analysis_version`
//! aggregates those into a single, deterministic string that is recorded per
//! track in `tracks.analysis_version` (see `DATA_MODEL.md` §2, row `analysis_version`).
//! Bumping any analyzer's pipeline version changes the composite, which is the
//! signal the re-analysis path keys off of (see `MODELS.md` §5: "Bump
//! `analysis_version` when ... pre-processing, or post-processing change").
//!
//! ## Format
//! `name:pipeline[@model];name:pipeline;...` in a fixed canonical order. The
//! `@model` segment is present only when an analyzer consumed a versioned ONNX
//! asset; the deterministic analyzers (T1.1.3–T1.1.7) leave it `None`. When the
//! ONNX analysis pipeline is wired in (Phase 1.2), the pipeline runner can
//! extend a [`VersionComponent`] with a model version via [`VersionComponent::with_model`].
//!
//! The whole string is treated as opaque by the DB layer: it is compared for
//! equality to decide whether a track needs re-analysis
//! (`API_CONTRACTS.md`: `force?: boolean // re-analyze even if current
//! analysis_version matches`).

use crate::{
    bpm::PIPELINE_VERSION as BPM_VERSION, key::KEY_PIPELINE_VERSION as KEY_VERSION,
    loudness::LOUDNESS_PIPELINE_VERSION as LOUDNESS_VERSION,
    phrase::PHRASE_PIPELINE_VERSION as PHRASE_VERSION,
    vocal::VOCAL_PIPELINE_VERSION as VOCAL_VERSION,
};

/// One analyzer's contribution to the composite `analysis_version`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VersionComponent {
    /// Analyzer identifier, e.g. `"bpm"`, `"key"`.
    pub name: &'static str,
    /// Pipeline version stamp, e.g. `"bpm.1.0.0"`.
    pub pipeline: &'static str,
    /// Optional model asset version consumed by this analyzer (`None` for the
    /// deterministic path), e.g. `"1.0.0"`.
    pub model: Option<&'static str>,
}

impl VersionComponent {
    /// Creates a deterministic (model-free) component.
    pub const fn new(name: &'static str, pipeline: &'static str) -> Self {
        Self {
            name,
            pipeline,
            model: None,
        }
    }

    /// Attaches a model asset version, producing `name:pipeline@model`.
    pub const fn with_model(self, model: &'static str) -> Self {
        Self {
            model: Some(model),
            ..self
        }
    }

    /// Renders this component as `name:pipeline` or `name:pipeline@model`.
    fn render(self, out: &mut String) {
        out.push_str(self.name);
        out.push(':');
        out.push_str(self.pipeline);
        if let Some(model) = self.model {
            out.push('@');
            out.push_str(model);
        }
    }
}

/// Ordered, canonical analyzer components. The order is fixed so the composite is
/// stable regardless of module evaluation order: a bumped component always
/// appears at the same position, and changing any version changes the whole
/// string.
pub const ANALYZER_VERSIONS: &[VersionComponent] = &[
    VersionComponent::new("bpm", BPM_VERSION),
    VersionComponent::new("key", KEY_VERSION),
    VersionComponent::new("phrase", PHRASE_VERSION),
    VersionComponent::new("vocal", VOCAL_VERSION),
    VersionComponent::new("loudness", LOUDNESS_VERSION),
];

/// Computes the canonical composite `analysis_version` string for the given
/// components, in slice order.
///
/// Pass [`ANALYZER_VERSIONS`] (or [`analysis_version`]) for the full
/// deterministic analyzer set; the pipeline runner can build its own list to
/// include model versions consumed from the registry.
pub fn compute_analysis_version(components: &[VersionComponent]) -> String {
    let total_len = components
        .iter()
        .map(|c| c.name.len() + 1 + c.pipeline.len() + c.model.map_or(0, |m| 1 + m.len()))
        .sum::<usize>()
        + components.len().saturating_sub(1);

    let mut out = String::with_capacity(total_len);
    for (i, component) in components.iter().enumerate() {
        if i > 0 {
            out.push(';');
        }
        component.render(&mut out);
    }
    out
}

/// Convenience: the composite `analysis_version` for the full deterministic
/// analyzer set (T1.1.3–T1.1.7). Identical to
/// `compute_analysis_version(ANALYZER_VERSIONS)`.
pub fn analysis_version() -> String {
    compute_analysis_version(ANALYZER_VERSIONS)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn analysis_version_is_deterministic() {
        let a = analysis_version();
        let b = analysis_version();
        assert_eq!(a, b, "analysis_version must be stable across calls");
    }

    #[test]
    fn analysis_version_contains_every_analyzer() {
        let v = analysis_version();
        for component in ANALYZER_VERSIONS {
            let mut expected = String::new();
            component.render(&mut expected);
            assert!(
                v.contains(&expected),
                "analysis_version must include {expected}; got {v}"
            );
        }
        assert_eq!(
            v.split(';').count(),
            ANALYZER_VERSIONS.len(),
            "one segment per analyzer"
        );
    }

    #[test]
    fn analysis_version_changes_when_any_pipeline_bumps() {
        let original = analysis_version();

        for i in 0..ANALYZER_VERSIONS.len() {
            let mut bumped: Vec<VersionComponent> = ANALYZER_VERSIONS.to_vec();
            bumped[i] = VersionComponent::new(ANALYZER_VERSIONS[i].name, "9.9.9");
            let result = compute_analysis_version(&bumped);

            assert_ne!(
                original, result,
                "bumping analyzer[{}] ({}) must change the composite; got {result}",
                i, ANALYZER_VERSIONS[i].name
            );
        }
    }

    #[test]
    fn analysis_version_encodes_model_version_when_present() {
        let mut with_model: Vec<VersionComponent> = ANALYZER_VERSIONS.to_vec();
        with_model[0] = VersionComponent::new("bpm", BPM_VERSION).with_model("1.0.0");
        let rendered = compute_analysis_version(&with_model);

        assert!(
            rendered.starts_with("bpm:bpm.1.0.0@1.0.0;"),
            "model version should render as name:pipeline@model; got {rendered}"
        );
        assert!(
            rendered != analysis_version(),
            "adding a model version must change the composite"
        );
    }

    #[test]
    fn compute_analysis_version_empty_components_is_empty() {
        assert_eq!(compute_analysis_version(&[]), "");
    }

    #[test]
    fn pipeline_versions_follow_house_semverish_format() {
        // Each analyzer's pipeline version is `name.X.Y.Z` per the house convention
        // (tested individually in bpm/key/phrase/vocal/loudness); sanity-check the
        // aggregate here so a malformed version breaks loudly.
        for component in ANALYZER_VERSIONS {
            let parts: Vec<&str> = component.pipeline.split('.').collect();
            assert_eq!(
                parts.len(),
                4,
                "{} expected name.X.Y.Z, got {}",
                component.name,
                component.pipeline
            );
            assert_eq!(parts[0], component.name);
            assert!(
                parts[1..].iter().all(|p| p.parse::<u32>().is_ok()),
                "numeric components expected in {}",
                component.pipeline
            );
        }
    }
}
