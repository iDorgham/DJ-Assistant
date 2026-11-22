//! Tag spelling aliases (Tag Surgeon T2.2.5).
//!
//! An alias maps one tag spelling to the canonical spelling a tag is saved as.
//! It applies when tags are written, so a track edited after the alias is saved
//! carries the canonical spelling. Tracks already in the library are not
//! rewritten; that is the T2.2.4 apply.
//!
//! The rules this module keeps:
//! * An alias is keyed by its fold key, so spellings that fold alike are one alias.
//! * The canonical spelling is lowercase and trimmed, the form the tag editor
//!   stores. Otherwise a saved alias would come out different from what was typed.
//! * An alias must change the spelling, and no alias chains: a canonical
//!   spelling cannot itself be an alias, and an alias cannot be a canonical one.

use std::collections::BTreeMap;

use crate::tag_clustering::normalize_tag;
use crate::tags::normalize_tags;

/// Every stored alias as `(alias, canonical)`, ordered by alias fold key.
pub const LIST_TAG_ALIASES_SQL: &str =
    "SELECT alias, canonical FROM tag_aliases ORDER BY alias_key ASC";

/// Inserts an alias, or replaces the canonical spelling of an existing one.
pub const UPSERT_TAG_ALIAS_SQL: &str = "INSERT INTO tag_aliases (alias_key, alias, canonical) \
     VALUES (?1, ?2, ?3) \
     ON CONFLICT(alias_key) DO UPDATE SET alias = excluded.alias, canonical = excluded.canonical";

/// Removes the alias whose fold key is bound as `?1`.
pub const DELETE_TAG_ALIAS_SQL: &str = "DELETE FROM tag_aliases WHERE alias_key = ?1";

/// The stored aliases, keyed by alias fold key, valued by canonical spelling.
pub type AliasMap = BTreeMap<String, String>;

/// Checks a proposed alias against the aliases already stored and returns its
/// fold key. The caller stores the alias under that key.
pub fn validate_alias(alias: &str, canonical: &str, existing: &AliasMap) -> Result<String, String> {
    if alias.trim().is_empty() || canonical.trim().is_empty() {
        return Err("an alias and its canonical spelling cannot be blank".to_string());
    }
    let key = normalize_tag(alias);
    if key.is_empty() {
        return Err(format!("\"{alias}\" has no letters or digits to match on"));
    }
    let collapsed = canonical.split_whitespace().collect::<Vec<_>>().join(" ");
    if canonical != collapsed || canonical != canonical.to_ascii_lowercase() {
        return Err(format!(
            "\"{canonical}\" must be lowercase, trimmed and single-spaced, as the tag editor saves it"
        ));
    }
    // Compare the spelling the editor would store, not the fold key: `Café`
    // saved as `cafe` changes the spelling, so it is a real alias.
    let saved_as = alias.split_whitespace().collect::<Vec<_>>().join(" ");
    if saved_as.to_ascii_lowercase() == canonical {
        return Err(format!("\"{alias}\" already saves as \"{canonical}\""));
    }
    if existing.contains_key(&normalize_tag(canonical)) {
        return Err(format!(
            "\"{canonical}\" is itself an alias, so it cannot be a canonical spelling"
        ));
    }
    if existing.values().any(|value| normalize_tag(value) == key) {
        return Err(format!(
            "\"{alias}\" is already the canonical spelling of another alias"
        ));
    }
    Ok(key)
}

/// Maps tags through the aliases: each tag whose fold key is an alias becomes
/// its canonical spelling. The result is the editor's normalised set.
pub fn map_tags(tags: &[String], aliases: &AliasMap) -> Vec<String> {
    let mapped: Vec<String> = tags
        .iter()
        .map(|tag| {
            aliases
                .get(&normalize_tag(tag))
                .cloned()
                .unwrap_or_else(|| tag.clone())
        })
        .collect();
    normalize_tags(&mapped)
}

#[cfg(test)]
mod tests {
    use super::{map_tags, validate_alias, AliasMap};

    fn aliases(pairs: &[(&str, &str)]) -> AliasMap {
        pairs
            .iter()
            .map(|(key, value)| (key.to_string(), value.to_string()))
            .collect()
    }

    #[test]
    fn a_valid_alias_is_keyed_by_its_fold_key() {
        let key = validate_alias("Melodic H.", "melodic house", &AliasMap::new()).unwrap();
        assert_eq!(key, "melodic h");
    }

    #[test]
    fn an_alias_that_differs_only_by_accents_is_accepted() {
        let none = AliasMap::new();
        assert_eq!(
            validate_alias("Café", "cafe", &none),
            Ok("cafe".to_string())
        );
    }

    #[test]
    fn invalid_aliases_are_refused() {
        let none = AliasMap::new();
        assert!(validate_alias("  ", "house", &none).is_err());
        assert!(validate_alias("!!!", "house", &none).is_err());
        // The canonical spelling must be the editor's form.
        assert!(validate_alias("hs", "House", &none).is_err());
        assert!(validate_alias("hs", " house", &none).is_err());
        // An alias must change the spelling.
        assert!(validate_alias("House", "house", &none).is_err());
    }

    #[test]
    fn no_alias_chains() {
        let existing = aliases(&[("hs", "house")]);
        // "hs" is an alias, so it cannot be a canonical spelling.
        assert!(validate_alias("tech", "hs", &existing).is_err());
        // "house" is a canonical spelling, so it cannot become an alias.
        assert!(validate_alias("house", "deep house", &existing).is_err());
    }

    #[test]
    fn tags_map_through_the_aliases_and_dedupe() {
        let map = aliases(&[("melodic h", "melodic house")]);
        let out = map_tags(
            &[
                "Melodic H.".to_string(),
                "melodic house".to_string(),
                "Peak".to_string(),
            ],
            &map,
        );
        assert_eq!(out, vec!["melodic house".to_string(), "peak".to_string()]);
    }

    #[test]
    fn unaliased_tags_pass_through_as_the_editor_stores_them() {
        let out = map_tags(&["Peak".to_string()], &AliasMap::new());
        assert_eq!(out, vec!["peak".to_string()]);
    }
}
