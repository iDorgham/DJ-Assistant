//! The soft-remove contract: what "Remove from library" writes, what bringing
//! it back takes, and what undoing either of them means.
//!
//! Like [`crate::library_query`], this module holds SQL as data and never runs
//! it — `core` stays free of a database dependency so the rules are unit
//! testable on any toolchain, and the desktop layer is the thin executor. The
//! statements are executed against the real migrated schema in
//! `tests/schema/tests/soft_remove.rs`.
//!
//! Two rules the whole module exists to keep:
//!
//! * **Nothing leaves the disk.** A remove sets `tracks.removed_at`; the row
//!   stays, so its cue points, tags and analysis survive — and so does an undo.
//! * **Every write is undoable.** The write is only committed together with a
//!   `skill_runs` row holding the pre-write values, in the same transaction.
//!
//! A restore from the removed view is a write of its own, not the remove's undo
//! replayed: it carries its own snapshot, so the action stays undoable no matter
//! how old the removal was or whether its toast has long gone.

/// The `skill_runs.skill_name` written by the remove path.
///
/// Undo checks it, so a snapshot id from another write path can never be
/// undone as a remove.
pub const REMOVE_SKILL_NAME: &str = "remove_from_library";

/// The `skill_runs.skill_name` written when the removed view puts tracks back.
///
/// Its snapshot runs the other way from a remove's — stamped before, clear
/// after — which is what lets the same undo restore the *original* stamp
/// instead of inventing a new one.
pub const RESTORE_SKILL_NAME: &str = "restore_to_library";

/// A statement ready to run: SQL text plus the parameters in `?N` order.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Statement {
    pub sql: String,
    /// Values are always bound — never interpolated — so a track id can only
    /// ever be data.
    pub params: Vec<String>,
}

/// The read half of the write: the rows the selection currently holds.
///
/// `ORDER BY id` keeps the snapshot — and so the undo — in the same order on
/// every run, which makes the recorded state comparable.
pub fn read_statement(ids: &[String]) -> Result<Statement, RemoveError> {
    if ids.is_empty() {
        return Err(RemoveError::EmptySelection);
    }
    Ok(Statement {
        sql: format!(
            "SELECT id, removed_at FROM tracks WHERE id IN ({}) ORDER BY id",
            placeholders(ids, 1)
        ),
        params: ids.to_vec(),
    })
}

/// The write half: `ids` leave the library, `removed_at` stamps them.
///
/// `AND removed_at IS NULL` does double duty: a track already out of the
/// library is not re-stamped, and the rows-affected count is the honest number
/// of tracks the user actually removed. `updated_at` moves with the row because
/// the row did change — the same rule every other write path follows.
pub fn remove_statement(ids: &[String], removed_at: &str) -> Result<Statement, RemoveError> {
    if ids.is_empty() {
        return Err(RemoveError::EmptySelection);
    }
    let mut params = vec![removed_at.to_string()];
    params.extend(ids.iter().cloned());
    Ok(Statement {
        sql: format!(
            "UPDATE tracks SET removed_at = ?1, updated_at = datetime('now') \
             WHERE id IN ({}) AND removed_at IS NULL",
            placeholders(ids, 2)
        ),
        params,
    })
}

/// The statements that put `states` back in the library, one per track.
///
/// A restore is a write of its own, so it is guarded like one: each statement
/// carries the `removed_at` the removed view actually showed. A track removed
/// again since then holds a newer stamp, matches nothing, and counts as
/// skipped — the newer action wins and the older view does not silently
/// overwrite it.
pub fn restore_statements(states: &[TrackState]) -> Result<Vec<Statement>, RemoveError> {
    if states.is_empty() {
        return Err(RemoveError::EmptySelection);
    }
    states
        .iter()
        .map(|state| match state.removed_at.as_deref() {
            Some(stamped) => Ok(clear_statement(&state.id, stamped)),
            None => Err(RemoveError::Corrupt(format!(
                "{} is already in the library",
                state.id
            ))),
        })
        .collect()
}

/// `UPDATE ... SET removed_at = NULL` for one track, holding only while the row
/// still carries `stamped`.
fn clear_statement(track_id: &str, stamped: &str) -> Statement {
    Statement {
        sql: "UPDATE tracks SET removed_at = NULL, updated_at = datetime('now') \
              WHERE id = ?1 AND removed_at IS ?2"
            .to_string(),
        params: vec![track_id.to_string(), stamped.to_string()],
    }
}

/// `UPDATE ... SET removed_at = <the stamp it had>` for one track, holding only
/// while the row is clear.
fn stamp_statement(track_id: &str, stamped: &str) -> Statement {
    Statement {
        sql: "UPDATE tracks SET removed_at = ?2, updated_at = datetime('now') \
              WHERE id = ?1 AND removed_at IS NULL"
            .to_string(),
        params: vec![track_id.to_string(), stamped.to_string()],
    }
}

/// The `skill_runs` row that makes the write undoable.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SkillRun {
    pub id: String,
    pub workspace_id: String,
    /// Which write path this snapshot belongs to — always one of this module's
    /// `*_SKILL_NAME` consts, never a string built from user data.
    pub skill_name: &'static str,
    pub before_state: String,
    pub after_state: String,
    pub input_summary: String,
}

/// Renders the snapshot row. `status` is `'success'` because the insert only
/// happens inside the transaction that does the write.
pub fn skill_run_insert(run: &SkillRun) -> Statement {
    Statement {
        sql: "INSERT INTO skill_runs (
            id, workspace_id, skill_name, status, input_summary, before_state, after_state,
            error, created_at
        ) VALUES (?1, ?2, ?3, 'success', ?4, ?5, ?6, NULL, datetime('now'))"
            .to_string(),
        params: vec![
            run.id.clone(),
            run.workspace_id.clone(),
            run.skill_name.to_string(),
            run.input_summary.clone(),
            run.before_state.clone(),
            run.after_state.clone(),
        ],
    }
}

/// `?start, ?start+1, ...` — one placeholder per value, in bind order.
fn placeholders(values: &[String], start: usize) -> String {
    (0..values.len())
        .map(|i| format!("?{}", start + i))
        .collect::<Vec<_>>()
        .join(", ")
}

/// One track as the snapshot sees it: its id and the value `removed_at` held.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrackState {
    pub id: String,
    pub removed_at: Option<String>,
}

/// Why a remove or an undo cannot run.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RemoveError {
    /// Nothing was selected, so there is no statement worth running.
    EmptySelection,
    /// The snapshot belongs to another write path — undoing it as a remove
    /// would restore columns this code knows nothing about.
    ForeignSnapshot(String),
    /// The snapshot was already undone.
    AlreadyUndone,
    /// The snapshot was never an applied write — a `failed` run has nothing to
    /// bring back. Carries the status it found.
    NotApplied(String),
    /// The snapshot does not parse, or does not describe a remove.
    Corrupt(String),
}

impl std::fmt::Display for RemoveError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RemoveError::EmptySelection => write!(f, "no tracks selected"),
            RemoveError::ForeignSnapshot(name) => write!(
                f,
                "snapshot is a {name} write, not a library remove or restore"
            ),
            RemoveError::AlreadyUndone => write!(f, "snapshot is already undone"),
            RemoveError::NotApplied(status) => {
                write!(f, "snapshot is {status}, not an applied remove")
            }
            RemoveError::Corrupt(why) => write!(f, "corrupt remove snapshot: {why}"),
        }
    }
}

/// Reads the snapshot row before it is undone.
///
/// `skill_name` is part of the read so the caller can hand [`check_undoable`]
/// the value it finds, rather than trusting the UI to have picked a remove
/// snapshot id.
pub const UNDO_READ_SQL: &str = "SELECT skill_name, status, before_state, after_state \
     FROM skill_runs WHERE id = ?1";

/// Marks a snapshot spent, which is what makes a second undo of the same id
/// refuse instead of restoring twice.
pub const MARK_UNDONE_SQL: &str = "UPDATE skill_runs SET status = 'undone' WHERE id = ?1";

/// The tracks in the selection that are actually in the library.
///
/// A track already out of it is not re-stamped: it belongs to an earlier
/// remove with its own snapshot, and undoing *this* one must not bring it back.
/// Returning the states — not just the ids — means the snapshot and the write
/// are both derived from the same filtered set, so they cannot disagree.
pub fn present_states(states: &[TrackState]) -> Vec<TrackState> {
    states
        .iter()
        .filter(|state| state.removed_at.is_none())
        .cloned()
        .collect()
}

/// The tracks in the selection that are out of the library.
///
/// The mirror of [`present_states`], and the reason a restore takes states
/// rather than ids: the stamp each track holds is what its statement matches
/// against, and a track that came back in between belongs to no removal this
/// action has any business touching.
pub fn removed_states(states: &[TrackState]) -> Vec<TrackState> {
    states
        .iter()
        .filter(|state| state.removed_at.is_some())
        .cloned()
        .collect()
}

/// The pre-write half of the snapshot: every track as it is right now.
pub fn before_doc(states: &[TrackState]) -> String {
    state_doc(
        states
            .iter()
            .map(|state| (state.id.as_str(), state.removed_at.as_deref())),
    )
}

/// The post-write half: the same tracks, stamped with `removed_at`.
///
/// This is what undo compares the current row against — the value that proves
/// nothing else touched the track in between.
pub fn after_doc(states: &[TrackState], removed_at: &str) -> String {
    state_doc(
        states
            .iter()
            .map(|state| (state.id.as_str(), Some(removed_at))),
    )
}

/// The post-restore half: the same tracks, back in the library.
///
/// Every one of them is clear, whatever stamp it carried, so the value is not
/// taken from the state — the state is only there to name the tracks.
pub fn restored_doc(states: &[TrackState]) -> String {
    state_doc(states.iter().map(|state| (state.id.as_str(), None)))
}

/// What the user asked for, recorded alongside what the write did.
pub fn input_doc(ids: &[String]) -> String {
    serde_json::json!({ "trackIds": ids }).to_string()
}

/// Renders `{ "<id>": { "removed_at": <value> } }` — the same shape the rating
/// and tag snapshots use, so one reader handles every `skill_runs` snapshot.
///
/// Keys are inserted into a [`serde_json::Map`], which orders them, so the two
/// halves of a snapshot line up without the caller sorting anything.
fn state_doc<'a, I>(entries: I) -> String
where
    I: Iterator<Item = (&'a str, Option<&'a str>)>,
{
    let mut doc = serde_json::Map::new();
    for (id, removed_at) in entries {
        let value = match removed_at {
            Some(stamped) => serde_json::Value::from(stamped),
            None => serde_json::Value::Null,
        };
        doc.insert(
            id.to_string(),
            serde_json::Value::Object([("removed_at".to_string(), value)].into_iter().collect()),
        );
    }
    serde_json::Value::Object(doc).to_string()
}

/// Parses one half of a snapshot back into track states.
pub fn parse_states(raw: &str) -> Result<Vec<TrackState>, RemoveError> {
    let parsed: serde_json::Value =
        serde_json::from_str(raw).map_err(|e| RemoveError::Corrupt(e.to_string()))?;
    let doc = parsed
        .as_object()
        .ok_or_else(|| RemoveError::Corrupt("snapshot is not an object".to_string()))?;
    doc.iter()
        .map(|(id, values)| {
            let removed_at = values
                .get("removed_at")
                .ok_or_else(|| RemoveError::Corrupt(format!("{id} has no removed_at")))?;
            let removed_at = match removed_at {
                serde_json::Value::Null => Ok(None),
                serde_json::Value::String(text) => Ok(Some(text.clone())),
                other => Err(RemoveError::Corrupt(format!(
                    "{id} has a non-string removed_at: {other}"
                ))),
            }?;
            Ok(TrackState {
                id: id.clone(),
                removed_at,
            })
        })
        .collect()
}

/// Guards the undo against a snapshot it has no business restoring.
///
/// Both removal paths are accepted — a remove and a restore are undone by the
/// same command, and [`undo_statements`] reads the direction off the snapshot
/// itself. Anything else (a rating, a metadata edit, an enrichment run) names
/// columns this code does not hold and must never be replayed as a removal.
pub fn check_undoable(skill_name: &str, status: &str) -> Result<(), RemoveError> {
    if skill_name != REMOVE_SKILL_NAME && skill_name != RESTORE_SKILL_NAME {
        return Err(RemoveError::ForeignSnapshot(skill_name.to_string()));
    }
    match status {
        "success" => Ok(()),
        "undone" => Err(RemoveError::AlreadyUndone),
        other => Err(RemoveError::NotApplied(other.to_string())),
    }
}

/// The statements that run a removal snapshot backwards, one per track.
///
/// The direction comes from the snapshot, not from a flag: `present → stamped`
/// was a remove, so its undo clears; `stamped → present` was a restore, so its
/// undo puts the *original* stamp back rather than a fresh `datetime('now')`,
/// which would record a removal at a time it did not happen.
///
/// Either way each statement carries the state the write left in its WHERE, so
/// a track edited in between is skipped rather than overwritten.
pub fn undo_statements(
    before: &[TrackState],
    after: &[TrackState],
) -> Result<Vec<Statement>, RemoveError> {
    if before.len() != after.len() {
        return Err(RemoveError::Corrupt(
            "the two halves of the snapshot cover different numbers of tracks".to_string(),
        ));
    }
    before
        .iter()
        .zip(after)
        .map(|(was, became)| {
            if was.id != became.id {
                return Err(RemoveError::Corrupt(format!(
                    "snapshot pairs {} with {}",
                    was.id, became.id
                )));
            }
            match (&was.removed_at, &became.removed_at) {
                (None, Some(stamped)) => Ok(clear_statement(&was.id, stamped)),
                (Some(stamped), None) => Ok(stamp_statement(&was.id, stamped)),
                (None, None) => Err(RemoveError::Corrupt(format!(
                    "{} was never stamped by this remove",
                    was.id
                ))),
                (Some(_), Some(_)) => Err(RemoveError::Corrupt(format!(
                    "{} holds a stamp on both sides, so this snapshot wrote nothing",
                    was.id
                ))),
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ids(values: &[&str]) -> Vec<String> {
        values.iter().map(|v| v.to_string()).collect()
    }

    fn state(id: &str, removed_at: Option<&str>) -> TrackState {
        TrackState {
            id: id.to_string(),
            removed_at: removed_at.map(|v| v.to_string()),
        }
    }

    #[test]
    fn only_present_tracks_are_removed() {
        // A selection that straddles a track already out of the library must
        // not re-stamp it: undo would then bring back a track the user removed
        // in an earlier, separately undoable action.
        let present = present_states(&[state("a", None), state("b", Some("2026-01-01 00:00:00"))]);
        assert_eq!(present, vec![state("a", None)]);
    }

    #[test]
    fn the_two_docs_describe_the_same_tracks_on_both_sides() {
        let states = [state("a", None), state("b", None)];
        assert_eq!(
            before_doc(&states),
            "{\"a\":{\"removed_at\":null},\"b\":{\"removed_at\":null}}"
        );
        assert_eq!(
            after_doc(&states, "2026-10-27 10:00:00"),
            "{\"a\":{\"removed_at\":\"2026-10-27 10:00:00\"},\"b\":{\"removed_at\":\"2026-10-27 10:00:00\"}}"
        );
        assert_eq!(input_doc(&ids(&["a", "b"])), "{\"trackIds\":[\"a\",\"b\"]}");
    }

    #[test]
    fn a_doc_round_trips_through_the_snapshot_column() {
        let parsed = parse_states(&after_doc(&[state("a", None)], "2026-10-27 10:00:00")).unwrap();
        assert_eq!(parsed, vec![state("a", Some("2026-10-27 10:00:00"))]);
        assert!(parse_states(&before_doc(&[state("a", None)])).unwrap() == vec![state("a", None)]);
        assert!(parse_states("not json").is_err());
        assert!(parse_states("{\"a\":{\"bpm\":128}}").is_err());
    }

    #[test]
    fn undo_reads_the_snapshot_row_it_is_about_to_rewrite() {
        // The skill_name is part of the read so the guard can check it: a
        // rating snapshot must never be undone as a remove.
        assert_eq!(
            UNDO_READ_SQL,
            "SELECT skill_name, status, before_state, after_state FROM skill_runs WHERE id = ?1"
        );
    }

    #[test]
    fn only_a_applied_remove_is_undoable() {
        assert!(check_undoable(REMOVE_SKILL_NAME, "success").is_ok());
        assert!(matches!(
            check_undoable("set_track_rating", "success"),
            Err(RemoveError::ForeignSnapshot(_))
        ));
        assert!(matches!(
            check_undoable(REMOVE_SKILL_NAME, "undone"),
            Err(RemoveError::AlreadyUndone)
        ));
        assert!(matches!(
            check_undoable(REMOVE_SKILL_NAME, "failed"),
            Err(RemoveError::NotApplied(_))
        ));
    }

    #[test]
    fn restore_only_touches_a_track_still_in_the_state_the_write_left() {
        let before = [state("a", None)];
        let after = [state("a", Some("2026-10-27 10:00:00"))];
        let built = undo_statements(&before, &after).unwrap();
        assert_eq!(built.len(), 1);
        assert_eq!(
            built[0].sql,
            "UPDATE tracks SET removed_at = NULL, updated_at = datetime('now') \
             WHERE id = ?1 AND removed_at IS ?2"
        );
        assert_eq!(built[0].params, ids(&["a", "2026-10-27 10:00:00"]));
    }

    #[test]
    fn a_snapshot_that_was_never_written_is_refused() {
        // before says "present", after says "still present" — the remove did
        // not stamp this track, so this snapshot does not describe a write.
        let before = [state("a", None)];
        let after = [state("a", None)];
        assert!(matches!(
            undo_statements(&before, &after),
            Err(RemoveError::Corrupt(_))
        ));
        // Both halves stamped describes neither direction: nothing moved.
        let stamped = [state("a", Some("2026-01-01 00:00:00"))];
        assert!(matches!(
            undo_statements(&stamped, &stamped),
            Err(RemoveError::Corrupt(_))
        ));
        // Mismatched id sets cannot be paired up, so they are refused too.
        assert!(undo_statements(&before, &[state("z", Some("2026-10-27 10:00:00"))]).is_err());
    }

    #[test]
    fn marking_the_snapshot_undone_is_what_blocks_a_second_undo() {
        assert_eq!(
            MARK_UNDONE_SQL,
            "UPDATE skill_runs SET status = 'undone' WHERE id = ?1"
        );
    }

    #[test]
    fn read_statement_binds_every_selected_id() {
        let built = read_statement(&ids(&["a", "b", "c"])).unwrap();
        assert_eq!(
            built.sql,
            "SELECT id, removed_at FROM tracks WHERE id IN (?1, ?2, ?3) ORDER BY id"
        );
        assert_eq!(built.params, ids(&["a", "b", "c"]));
    }

    #[test]
    fn a_track_id_is_never_interpolated_into_sql() {
        // The read path takes ids straight from the UI. A quote in an id must
        // stay data, not become syntax.
        let hostile = ids(&["x' OR 1=1 --"]);
        let built = read_statement(&hostile).unwrap();
        assert!(!built.sql.contains("OR 1=1"));
        assert_eq!(built.params, hostile);
        assert_eq!(
            built.sql,
            "SELECT id, removed_at FROM tracks WHERE id IN (?1) ORDER BY id"
        );
    }

    #[test]
    fn an_empty_selection_is_refused_before_any_statement() {
        // The UI never offers this, but the IPC does take a list from the
        // front end, and a remove of nothing must not become a snapshot of
        // nothing that undo can later be handed.
        assert_eq!(read_statement(&[]).err(), Some(RemoveError::EmptySelection));
        assert_eq!(
            remove_statement(&[], "2026-10-27 10:00:00").err(),
            Some(RemoveError::EmptySelection)
        );
    }

    #[test]
    fn remove_statement_stamps_only_present_tracks() {
        let built = remove_statement(&ids(&["a", "b"]), "2026-10-27 10:00:00").unwrap();
        assert_eq!(
            built.sql,
            "UPDATE tracks SET removed_at = ?1, updated_at = datetime('now') \
             WHERE id IN (?2, ?3) AND removed_at IS NULL"
        );
        assert_eq!(built.params, ids(&["2026-10-27 10:00:00", "a", "b"]));
    }

    #[test]
    fn snapshot_row_records_the_states_on_both_sides_of_the_write() {
        let run = SkillRun {
            id: "run-1".into(),
            workspace_id: "default".into(),
            skill_name: REMOVE_SKILL_NAME,
            before_state: "{\"a\":{\"removed_at\":null}}".into(),
            after_state: "{\"a\":{\"removed_at\":\"2026-10-27 10:00:00\"}}".into(),
            input_summary: "{\"trackIds\":[\"a\"]}".into(),
        };
        let built = skill_run_insert(&run);
        assert_eq!(
            built.sql,
            "INSERT INTO skill_runs (
            id, workspace_id, skill_name, status, input_summary, before_state, after_state,
            error, created_at
        ) VALUES (?1, ?2, ?3, 'success', ?4, ?5, ?6, NULL, datetime('now'))"
        );
        assert_eq!(
            built.params,
            ids(&[
                "run-1",
                "default",
                REMOVE_SKILL_NAME,
                "{\"trackIds\":[\"a\"]}",
                "{\"a\":{\"removed_at\":null}}",
                "{\"a\":{\"removed_at\":\"2026-10-27 10:00:00\"}}",
            ])
        );
    }

    #[test]
    fn a_restore_snapshot_names_the_restore_write() {
        // One `skill_runs` table, several write paths: the row has to say which
        // one wrote it, or `check_undoable` cannot tell a restore undo from a
        // remove undo and the wrong statement pair runs against the tracks.
        assert_eq!(RESTORE_SKILL_NAME, "restore_to_library");
        let built = skill_run_insert(&SkillRun {
            id: "run-2".into(),
            workspace_id: "default".into(),
            skill_name: RESTORE_SKILL_NAME,
            before_state: "{\"a\":{\"removed_at\":\"2026-10-27 10:00:00\"}}".into(),
            after_state: "{\"a\":{\"removed_at\":null}}".into(),
            input_summary: "{\"trackIds\":[\"a\"]}".into(),
        });
        assert_eq!(built.params[2], RESTORE_SKILL_NAME.to_string());
    }

    #[test]
    fn only_removed_tracks_are_kept_for_a_restore() {
        // The mirror of `present_states`: a track still in the library belongs
        // to no remove of ours, so restoring it would write a snapshot that
        // undo could later use to stamp a present track.
        let removed = removed_states(&[state("a", Some("2026-10-27 10:00:00")), state("b", None)]);
        assert_eq!(removed, vec![state("a", Some("2026-10-27 10:00:00"))]);
    }

    #[test]
    fn a_restore_clears_only_a_track_still_holding_its_stamp() {
        // Optimistic locking in the other direction: `?2` is the `removed_at`
        // the removed view showed. A track removed again in between holds a
        // newer stamp, matches nothing and is skipped — the newer action wins.
        let built = restore_statements(&[state("a", Some("2026-10-27 10:00:00"))]).unwrap();
        assert_eq!(built.len(), 1);
        assert_eq!(
            built[0].sql,
            "UPDATE tracks SET removed_at = NULL, updated_at = datetime('now') \
             WHERE id = ?1 AND removed_at IS ?2"
        );
        assert_eq!(built[0].params, ids(&["a", "2026-10-27 10:00:00"]));
    }

    #[test]
    fn a_restore_never_clears_a_track_that_is_already_in_the_library() {
        assert!(matches!(
            restore_statements(&[state("a", None)]),
            Err(RemoveError::Corrupt(_))
        ));
        assert_eq!(
            restore_statements(&[]).err(),
            Some(RemoveError::EmptySelection)
        );
    }

    #[test]
    fn the_restore_snapshot_records_the_stamp_and_the_clear() {
        let states = [state("a", Some("2026-10-27 10:00:00"))];
        assert_eq!(
            before_doc(&states),
            "{\"a\":{\"removed_at\":\"2026-10-27 10:00:00\"}}"
        );
        assert_eq!(restored_doc(&states), "{\"a\":{\"removed_at\":null}}");
    }

    #[test]
    fn undoing_a_restore_stamps_the_track_back_with_its_old_value() {
        // The snapshot is the only place the original stamp survives, so the
        // undo of a restore puts that exact value back rather than a fresh
        // `datetime('now')` — which would invent a removal the user never made.
        let before = [state("a", Some("2026-10-27 10:00:00"))];
        let after = [state("a", None)];
        let built = undo_statements(&before, &after).unwrap();
        assert_eq!(
            built[0].sql,
            "UPDATE tracks SET removed_at = ?2, updated_at = datetime('now') \
             WHERE id = ?1 AND removed_at IS NULL"
        );
        assert_eq!(built[0].params, ids(&["a", "2026-10-27 10:00:00"]));
    }

    #[test]
    fn both_removal_snapshots_are_undoable() {
        assert!(check_undoable(RESTORE_SKILL_NAME, "success").is_ok());
        assert!(matches!(
            check_undoable(RESTORE_SKILL_NAME, "undone"),
            Err(RemoveError::AlreadyUndone)
        ));
    }
}
