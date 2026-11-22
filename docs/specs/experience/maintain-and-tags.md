# Maintain and Tags

Last updated: 2026-10-23  
Status: Hybrid tag model confirmed; cleanup rules locked

## 1. Purpose

Maintain is where the library gets healthier. Tags are the backbone of that work: they drive filtering, playlists, Discover recommendations, Statistics and Set Score.

The goal is not to impose a perfect taxonomy. The goal is to make the user's taxonomy consistent, searchable and useful.

## 2. Confirmed tag model

**Confirmed: hybrid.**

```text
Hierarchical
  Genre
    House
      Deep House
      Tech House
      Progressive House
    Techno
      Melodic Techno
      Peak Time Techno

Flat facets
  Style
  Mood
  Set Position
  Vocal
  Version
  Content
  Structure
  Era
  Source
  Custom

Numeric
  Energy (1–10)
```

### Why hybrid

- Genre naturally has a parent/child relationship.
- Style and Mood are often multi-value and do not need a tree.
- Set Position is contextual.
- Energy is numeric, not a tag tree.
- A flat-only model makes genre cleaning hard.
- A fully hierarchical model makes everyday tagging slow.

### 2.1 Hierarchical fields

| Field | Cardinality | Examples |
|---|---|---|
| Genre | Exactly one primary path | House → Deep House |
| Subgenre | One primary, optional secondary | Tech House |
| Label | One or more | Dirtybird, Ninja Tune |
| Release | One | Album/EP/Single |

Rules:

- A track has one primary genre path.
- Subgenre is optional, but recommended.
- Do not force every track into a subgenre.
- Preserve the original genre string in an `original_genre` field.
- The genre tree can be edited by the user.
- System genres can be renamed, not deleted, if in use.

### 2.2 Flat facets

| Facet | Cardinality | Examples |
|---|---|---|
| Style | Multi | Minimal, Groovy, Dark, Hypnotic, Tribal |
| Mood | Multi | Happy, Melancholic, Tense, Euphoric, Trippy |
| Set Position | Multi | Warm-up, Build, Peak, Closing, Afterhours |
| Vocal | Single | Instrumental, Vocal, Chant, Spoken |
| Version | Single | Original, Remix, Edit, Extended, Dub, Bootleg |
| Content | Multi | Classic, New, Promo, Free Download, Unreleased |
| Structure | Multi | Intro, Breakdown, Drop, Tool |
| Era | Single | 90s, 2000s, 2010s, 2020s |
| Source | Single | Bandcamp, SoundCloud, Label Promo, Beatport, DJ Pool |
| Custom | Multi | User-defined |

Rules:

- Flat facets can have multiple values.
- Flat facets are not nested by default.
- A flat facet can be promoted to a tree later if the user needs it.
- Do not create synonyms without aliases.
- Tags can be system or user-created.

### 2.3 Energy

Energy is numeric, 1–10.

```text
1–2  Ambient / warm-up
3–4  Low / groove
5–6  Mid / build
7–8  Peak
9–10 Maximum / closing
```

Rules:

- Energy is not a tag; it is a numeric attribute.
- Energy cannot be created, assigned or filtered as a tag anywhere in the UI.
- It can be set manually or suggested by analysis.
- Suggestions show confidence.
- Do not overwrite manual energy without confirmation.
- Statistics and Set Score use the numeric value.

### 2.4 Rating

- Display: 0–5 stars with half-stars.
- Storage: 0–10 integer.
- 0 means unrated.
- 1–10 maps to half-star increments.
- Sync adapters map the stored value to each DJ app's native scale.
- Statistics and filters use the stored integer.

### 2.5 Custom tags

- Namespace: `custom`.
- User can create, rename, merge and delete.
- Custom tags appear in filters and the tag browser.
- Custom tags are global in v1.
- Playlist-scoped custom tags are later.
- Do not let custom tags collide with system namespaces.

## 3. Tag data model

```text
tags
  id
  namespace       genre | style | mood | set_position | vocal | version |
                  content | structure | era | source | custom
  name
  parent_id       nullable; used by genre
  path            cached path for genre
  color           optional
  is_system
  created_at
  updated_at

tag_aliases
  id
  tag_id
  alias
  source          manual | musicbrainz | import

track_tags
  track_id
  tag_id
  source          manual | import | smart_fix | sync
  confidence      0–1
  created_at
```

Indexes:

- `tags(namespace, name)`
- `tags(parent_id)`
- `track_tags(track_id)`
- `track_tags(tag_id)`
- Full-text search on tag names and aliases.

## 4. Tag UI

### 4.1 Tag browser

```text
Tags
  Genre
    House
      Deep House
      Tech House
    Techno
      Melodic Techno
  Style
    Dark
    Groovy
    Hypnotic
  Mood
    Euphoric
    Melancholic
  Set Position
    Warm-up
    Peak
    Closing
```

- Tree for Genre.
- Flat groups for facets.
- Counts per tag.
- Search.
- Create.
- Rename.
- Merge.
- Add alias.
- Delete only when unused or with reassignment.

### 4.2 Inline editing

- Click a tag chip to open a picker.
- Type to search.
- Create new tag without leaving the picker.
- Multi-select flat tags.
- Single-select hierarchical tags.
- Keyboard: arrow keys, Enter, Escape.
- Show “used by N tracks”.
- Show alias matches.

### 4.3 Track tags

The shared Track panel shows:

- Genre path.
- Style chips.
- Mood chips.
- Set Position chips.
- Vocal, Version, Content, Structure.
- Energy slider.
- Custom tags.

Rules:

- Changes are staged until Save.
- The Track panel has an explicit Save.
- Unsaved changes are indicated.
- Undo is available after save.

## 5. Genre Cleanup

Genre Cleanup is a section inside Maintain.

### Inputs

- Existing genre strings.
- Unmapped values.
- Duplicates.
- Synonyms.
- Case variants.
- Imported DJ app genres.
- User-created genres.

### Suggested actions

| Problem | Example | Action |
|---|---|---|
| Case variant | `deep house` / `Deep House` | Merge into canonical |
| Synonym | `DnB` / `Drum & Bass` | Add alias or merge |
| Over-specific | `Deep House / Vocal` | Split into genre + vocal |
| Wrong level | `House` for a tech house track | Suggest subgenre |
| Unknown | `Electronic` | Review |
| Duplicate path | `Techno/Melodic` and `Melodic Techno` | Merge |
| Empty | blank | Review |

### Workflow

```text
1. Scan
2. Group
3. Suggest canonical mapping
4. Preview affected tracks
5. Apply
6. Undo if needed
```

Rules:

- Do not rewrite on import.
- Do not force a genre.
- Keep the original string.
- Show confidence.
- Allow “keep as is”.
- Allow “create new genre”.
- Allow “map to parent”.
- Bulk apply only after preview.

## 6. Artist Cleanup

### Inputs

- Artist strings.
- Album artist strings.
- Collaborations.
- Aliases.
- Case/punctuation variants.
- “feat.” variants.
- Various Artists.
- Duplicate artist records.

### Suggested actions

| Problem | Example | Action |
|---|---|---|
| Case variant | `deadmau5` / `Deadmau5` | Merge |
| Punctuation | `A & B` / `A and B` | Alias |
| Collaboration | `A feat. B` | Split or preserve |
| Alias | `Daft Punk` / `Daft Punk (FR)` | Merge |
| Duplicate | two artist rows | Merge |
| Various | `VA` / `Various Artists` | Normalize |
| Empty | blank | Review |

### Workflow

```text
1. Scan
2. Group by canonical candidate
3. Show evidence
4. Preview affected tracks
5. Apply
6. Undo if needed
```

Rules:

- Do not merge by name alone.
- Use MusicBrainz IDs where available.
- Preserve display names.
- Keep collaboration strings if the user prefers.
- Show which tracks change.
- Do not change `album artist` silently.

## 7. Duplicates

See `library-and-maintain.md` for the UI.

Tag-specific rules:

- Duplicate merge should not lose tags.
- Merge tag sets into the keeper.
- Preserve conflicting values for review.
- Record the merge in History.
- Quarantine the losing file; do not delete it.
- If both files are kept, mark them as versions, not duplicates.

## 8. Smart Fixes

Smart Fixes are reviewable recommendations.

### Low-risk fixes

- Normalize case.
- Trim whitespace.
- Fix punctuation.
- Add alias.
- Fill missing year from release.
- Normalize `feat.`.
- Set energy from analysis with confidence.
- Add missing genre from a high-confidence match.

### Medium-risk fixes

- Merge duplicate artists.
- Merge duplicate genres.
- Move a track to a different subgenre.
- Change album artist.
- Relink a missing file.
- Merge duplicate tracks.

### High-risk fixes

- Bulk rename genres.
- Bulk reassign artists.
- Remove tracks from playlists.
- Quarantine tracks.
- Purge tracks.
- Rewrite file paths.

High-risk fixes require:

- Preview.
- Scope count.
- Backup snapshot.
- Typed confirmation for purge.
- Audit log.

## 9. Quarantine

### Suggested criteria

- Never played.
- Not in any playlist.
- Rating at or below a threshold.
- Added more than N months ago.
- No cues.
- No tags.
- Duplicate loser.
- Missing file.
- Low quality.
- Ignored.

Defaults:

```text
Never played: on
Not in playlists: on
Rating: <= 2
Age: >= 12 months
```

The age default is 12 months, with 6/12/24-month presets. Use AND logic by default so the suggestion is conservative.

### Quarantine workflow

```text
Review suggestions
  → Select tracks
  → Quarantine
  → Tracks leave normal views
  → Restore or purge later
```

Rules:

- Quarantine is logical by default; files do not move.
- Optional “move file to quarantine folder” for users who want physical separation.
- Quarantined tracks keep metadata and playlist references.
- Quarantined tracks are excluded from Set Score and USB export by default.
- Restore is one click.
- Purge is separate and permanent.
- Purge requires typed confirmation.
- Purge creates a metadata snapshot first.
- Purge is recorded in History.

## 10. Library Health

Proposed categories:

| Category | Weight | What to measure |
|---|---|---|
| Metadata completeness | 20% | title, artist, album, genre, year, label |
| Tag coverage | 15% | genre, style, mood, energy |
| Analysis coverage | 15% | BPM, key, beat grid, waveform |
| File health | 15% | missing, corrupt, unreadable |
| Duplicates | 10% | exact and near duplicates |
| Playlist integrity | 10% | broken entries, orphaned tracks |
| Sync health | 10% | unresolved conflicts |
| Backup health | 5% | last verified backup age |

Rules:

- Score is 0–100.
- Show the contributing counts.
- Click a category to open the filtered list.
- Do not use a single score without explanation.
- Weights are locked: 20/15/15/15/10/10/10/5; unconfigured categories are neutral.

## 11. Undo and History

Undoable:

- Tag edits.
- Genre mapping.
- Artist merge (if reversible).
- Rating changes.
- Energy changes.
- Playlist edits.
- Smart Fix application.

Not silently undoable:

- Purge.
- Restore.
- USB export.
- Sync push.
- Backup deletion.

Those require a new operation and are recorded in History.

## 12. Tag decisions

Confirmed:

1. Hybrid model.
2. One primary genre path per track.
3. Subgenre is the second level of the genre tree.
4. Flat facets: Style, Mood, Set Position, Vocal, Version, Content, Structure, Era, Source, Custom.
5. Energy is numeric 1–10 and is not a tag.
6. Rating is 0–5 stars with half-stars, stored 0–10.
7. Custom tags are global in v1.
8. Cleanup age default is 12 months, with 6/12/24-month presets.
9. Library Health weights: 20/15/15/15/10/10/10/5; unconfigured categories are neutral.
10. Smart Fix auto-apply: no silent auto-apply; preview + one-click apply.

Still open:

1. Whether Smart Fixes can auto-apply low-risk fixes.
2. Whether custom tags can be playlist-scoped later.

See `06-delivery/open-questions.md`.
