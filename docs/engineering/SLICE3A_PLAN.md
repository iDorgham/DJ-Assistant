# Slice 3A — Tags + Comments (T2.1.7, T2.1.13)

**Status:** planned, not started (2026-10-22)  
**Scope:** 3A = tag chips, the tag filter and the comment edit surface.  
**3B = T2.1.8** (key pills, harmonic relations, the key-format preference) is a
separate increment — it needs new key modules and a Settings surface the app
does not have yet.

---

## 1. Locked decisions (2026-10-22, human)

| Decision | Choice | Consequence |
| --- | --- | --- |
| Where the user's comment lives | It **overwrites** `tracks.comments` | The file's original comment is replaced by the first edit. The reversible write path snapshots the previous value, so the first edit stays undoable. `tracks.notes` remains unused. |
| Where tags live | A **`track_tags` table** | Rows per tag: plain-SQL filtering, an index on the tag, and the natural base for the Tag Surgeon (T2.2) later. |
| How the slice is cut | **3A = T2.1.7 + T2.1.13**, 3B = T2.1.8 | 3B is deferred because a Settings surface for the key preference does not exist yet. |
| Where the editor is reached | A **row context menu** (right-click), per docs/ui/03 §3.5 | The menu ships only the actions that exist — "Edit tags…" — so the other spec items can be plugged in later. It is a new surface: positioning, Escape, focus return, keyboard access. |
| Which fields the editor covers | Title, artist, album, genre, **label**, **year**, custom tags, comment | `year` is already in the schema and populated for 90 of 94 tracks, so it costs a `TrackSummary` change only. `label` needs a one-line `ALTER` and has **no import source** — it is a field the user types. |

## 2. Where the code stands today

- **Schema:** `tracks` (migration 001) carries title, artist, album, genre,
  year, bpm, keys, `user_rating`, `notes`, `comments`, artwork columns — and
  **no tag storage at all**. `notes` is never written.
- **Import:** the scanner
  ([scanner.rs](../../../apps/desktop/src-tauri/src/scanner.rs)) copies a fixed
  field set out of the file tags; `comments` is the import-sourced comment
  ([metadata.rs](../../../crates/core/src/metadata.rs) reads `COMMENT` /
  `DESCRIPTION`).
- **Types:** `TrackSummary` (Rust [models.rs:7](../../../apps/desktop/src-tauri/src/models.rs)
  and its TS mirror in `packages/shared`) has `comments` but **no `tags`, no
  `label`, no `year`**.
- **Write path:** `update_track_metadata` / `MetadataPatch` cover **rating and
  energy only**. The undo snapshot is a `skill_runs` row with JSON
  `before_state` / `after_state`, written in the same transaction as the
  UPDATE.
- **Query path:** `library_query.rs` supports free-text (with `ESCAPE`), BPM
  range, Camelot key list, analysis-status list, genre list, rating floor and
  energy range — **no tag filter**.
- **UI:** the filter bar lives inside `App.tsx`; `ModalShell` is available for
  a dialog; **no row context menu exists** (only the column-header one, which
  opens the column picker).
- **Spec:** the `tags` column defaults to **Off** (docs/ui/03 §3.2); the
  "Edit tags…" action in docs/ui/03 §3.5 lists title, artist, album, genre,
  label, year, custom tags **and the free-text comment**.

## 3. Schema — migration 007

New file: `apps/desktop/src-tauri/migrations/007_track_tags_table.sql` (named to
stay clear of `002_track_tags.sql`, which only adds the comment and artwork
columns).

```sql
ALTER TABLE tracks ADD COLUMN label TEXT;

CREATE TABLE IF NOT EXISTS track_tags (
    track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY (track_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_track_tags_tag ON track_tags(tag);
```

The `ALTER` must stay **one physical line** — `db.rs::without_applied_alters`
parses only single-line `ALTER TABLE … ADD COLUMN` statements, and the energy
migration had to be written that way for the same reason.

`label` has **no import source**: the file-tag extractor never reads a
label/publisher tag, and no track in the live library carries one. It is a
user-typed field, so the editor must show an empty state rather than pretend
it is synced.

## 4. Backend work

1. **`db.rs`** — register migration 007 next to 006.
2. **`models.rs`** — `TrackSummary` gains `tags: Vec<String>`,
   `label: Option<String>` and `year: Option<i64>` (the two columns exist by
   007); `UpdateTrackMetadataRequest` gains the editable fields and
   `tags: Option<Vec<String>>`. The TS mirror in `packages/shared` follows.
3. **`commands.rs`** — generalise `MetadataPatch` from two numeric columns to
   the metadata set (title, artist, album, genre, label, year, comments) plus a
   tag list. The Slice 2 rules carry over unchanged: only a value that really
   differs is written and snapshotted, `updated` counts the tracks that
   changed, and the undo restores the previous value while **skipping** a
   track edited again since the snapshot.
   - **Tags are a set, not a scalar** — the first non-scalar snapshot in this
   path. The snapshot must record the previous tag set per track, and the
   restore (delete the current rows, re-insert the snapshot) has to be
   transactional.
4. **`list_tracks`** — read the tags of the returned page. Cheapest correct
   shape: a second query `SELECT track_id, tag FROM track_tags WHERE track_id
   IN (…)`, grouped in Rust. A `GROUP_CONCAT` would fight the row-per-page
   assumption and the separator escaping.
5. **`library_query.rs`** — a `tag` filter:
   `EXISTS (SELECT 1 FROM track_tags tt WHERE tt.track_id = tracks.id AND
   tt.tag IN (…))`, with the same bound-parameter and invalid-value rules as
   the other list filters. Free-text search gains `comments` (T2.1.13) and tag
   values (the tag-field half of T2.1.1) through the existing `ESCAPE` path.

## 5. Front-end work

1. **`packages/shared`** — `TrackSummary.tags: string[]` (and `label` / `year`
   if they are added).
2. **`components/TagChips.tsx`** — the chips, the `+N` overflow, and a click
   that pushes the tag into the filter bar (docs/ui/03 §3.2). One button per
   chip, keyboard reachable, `aria-label` naming the tag.
3. **`lib/library-columns.ts`** — a `tags` column entry, default **Off**, cell
   text = the chips, tooltip = the full list.
4. **The metadata editor** — `ModalShell` plus a form: title, artist, album,
   genre, label, year, custom tags (a chip input) and the free-text
   **comment**. It writes through `update_track_metadata`, so it inherits the
   same Undo toast. A multi-selection applies to the whole selection (the
   table subset; the BulkActionBar stays T2.1.3).
5. **The entry point — a row context menu** (decided 2026-10-22) — a new
   `components/RowContextMenu.tsx`, opened by right-clicking a row. It
   positions itself at the cursor, closes on Escape and on an outside click,
   returns focus to the row, and is reachable by keyboard. It ships **only**
   "Edit tags…" — the other items docs/ui §3.5 lists (Fix tags, Add to
   playlist, Find in playlists, Mix suggestions, online find, Remove from
   library) act on features that do not exist yet and are added later rather
   than shipped as disabled clutter. The spec's selection semantics carry
   over: an action either applies to the whole selection or acts on the
   focused row.
6. **The Undo toast** — reuse the Slice 2 pattern: the same message shape,
   the same timer, focus pauses it, the dismiss button closes it.

## 6. Test plan

- **Rust unit tests** — the tag filter (in / out), the `ESCAPE` path with a tag
  containing `%` or `_`, the patch and skip semantics (a track changed since
  the snapshot is skipped, not overwritten).
- **Schema tests** (`tests/schema`) — the mirrored SQL against a migrated
  schema, the tag rows and their cascade on track delete, count/rows
  agreement.
- **`node --test` pure helpers** — the chip overflow (`+N` cut-off), tag
  normalisation (case, blanks, duplicates), the editor payload builder.
- **The QA gate** — the same discipline as Slice 2: the human clicks in the
  `tauri dev` window, the agent verifies the database read-only. **A browser
  tab is a mock** (F-009) and proves nothing.

## 7. Definition of Done (3A)

- [ ] A tag chip in the table filters the list by that tag, and the resulting
      filter chip can be removed.
- [ ] A comment edited in the metadata editor persists, is found by the search
      field, and comes back through Undo.
- [ ] Undo restores a removed tag set, and skips a track that changed since
      the snapshot.
- [ ] The `tags` column is off by default and the table layout survives it.
- [ ] Right-clicking a row opens the context menu, Escape closes it, focus
      returns to the row, and "Edit tags…" opens the editor for the focused
      row.
- [ ] No console errors, and the table still renders every row (row
      virtualization stays Slice 9).
- [ ] The running-window QA pass is recorded — the same "observation **and**
      database check" rule as Slice 2.

## 8. Risks

- **`label` is a field nothing can fill.** It has no import source and no data in
  the live library, so the editor shows it empty and the user types it. If a
  label source appears later (enrichment, T2.2), the column is already there.
- **The row context menu is a second UI surface** — budget for positioning,
  keyboard access and focus handling, and for the focus return the table
  already has to do for the column picker.
- **The first non-scalar undo snapshot.** A set restore must be atomic, or an
  interrupted undo leaves a half-restored tag set.
- **The tag filter must not disturb the pagination tiebreaker (`id`) or the
  NULLs-last sort** — the filter is an `EXISTS`, not a join, so the row shape
  stays one row per track.
- **Overwriting `comments` loses the file's original comment.** Undo is the
  only way back, so the Undo toast must not be missed or dismissed by accident.

## 9. Sequence

| # | Task |
| --- | --- |
| T3A.1 | Migration 007 + registration in `db.rs` |
| T3A.2 | Shared + Rust types (`tags`, the extended request) |
| T3A.3 | Read path: the tags of a page in `list_tracks` |
| T3A.4 | Query path: the tag filter, `comments` and tag search |
| T3A.5 | Write path: the generalised patch, the snapshot, the undo |
| T3A.6 | `TagChips` + the `tags` column |
| T3A.7 | The row context menu + the metadata editor |
| T3A.8 | Tests (Rust unit, schema, `node --test`) |
| T3A.9 | Docs: the task entries, the memory layers, the QA checklist |
