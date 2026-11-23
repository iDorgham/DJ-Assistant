//! Tag aliases (T2.2.5), run against the real migrated schema.
//!
//! The alias SQL lives in `crates/core/src/tag_aliases.rs`; this file executes it
//! so the table, the upsert and the listing order are proven, not assumed.

use dj_assistant_core::tag_aliases::{
    validate_alias, AliasMap, DELETE_TAG_ALIAS_SQL, LIST_TAG_ALIASES_SQL, UPSERT_TAG_ALIAS_SQL,
};
use dj_assistant_core::tag_clustering::normalize_tag;
use dj_assistant_schema_tests::open_migrated;
use rusqlite::Connection;

/// Stores an alias the way the desktop command does: validate, then upsert.
fn store(conn: &Connection, alias: &str, canonical: &str) -> Result<(), String> {
    let existing: AliasMap = list(conn)
        .into_iter()
        .map(|(alias, canonical)| (normalize_tag(&alias), canonical))
        .collect();
    let key = validate_alias(alias, canonical, &existing)?;
    conn.execute(
        UPSERT_TAG_ALIAS_SQL,
        rusqlite::params![key, alias.trim(), canonical],
    )
    .expect("the alias upsert must run as built");
    Ok(())
}

fn list(conn: &Connection) -> Vec<(String, String)> {
    let mut stmt = conn
        .prepare(LIST_TAG_ALIASES_SQL)
        .expect("the alias list must prepare");
    stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .expect("the alias list must run")
        .collect::<Result<_, _>>()
        .expect("every alias row must read")
}

#[test]
fn an_alias_is_stored_once_per_fold_key_and_listed_in_key_order() {
    let conn = open_migrated();
    store(&conn, "tech H.", "tech house").unwrap();
    store(&conn, "Melodic H.", "melodic house").unwrap();
    // The same fold key replaces the canonical spelling rather than adding a row.
    store(&conn, "melodic h", "melodic house music").unwrap();
    assert_eq!(
        list(&conn),
        vec![
            ("melodic h".to_string(), "melodic house music".to_string()),
            ("tech H.".to_string(), "tech house".to_string()),
        ]
    );
}

#[test]
fn a_chained_alias_is_refused_and_nothing_is_stored() {
    let conn = open_migrated();
    store(&conn, "hs", "house").unwrap();
    assert!(store(&conn, "tech", "hs").is_err());
    assert!(store(&conn, "house", "deep house").is_err());
    assert_eq!(list(&conn).len(), 1);
}

#[test]
fn removing_an_alias_uses_its_fold_key() {
    let conn = open_migrated();
    store(&conn, "Melodic H.", "melodic house").unwrap();
    conn.execute(DELETE_TAG_ALIAS_SQL, [normalize_tag("melodic h")])
        .expect("the alias delete must run as built");
    assert!(list(&conn).is_empty());
}
