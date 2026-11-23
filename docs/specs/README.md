# Specs

How each feature **behaves**: flows, states, rules, data. Product intent lives in
[`product/`](../product/), visual design in [`ui-ux/`](../ui-ux/README.md), delivery
order in [`plans/`](../plans/README.md).

| Folder | Contents |
|--------|----------|
| [`experience/`](experience/) | Every tab and workspace: shell and Inbox, Library and Maintain, tags, Playlists and Set Score, Discover, Statistics, Publish and USB, Settings, Track panel and player |
| [`player/`](player/) | Player model and layouts, EQ8 and cues, playlist save/recovery, player settings and accessibility |
| [`data-and-sync/`](data-and-sync/) | Import and enrichment, data model, sync and source of truth, backup and restore |
| [`integrations/`](integrations/) | Provider API access guide (Discover, Statistics, Backup) |
| [`features/`](features/) | Dated design specs for single features (e.g. Tag Surgeon fuzzy clustering) |

The `experience/`, `player/` and `data-and-sync/` specs come from the approved
[v1 plan](../plans/v1/README.md) and carry its locked decisions (D-001–D-052).
New feature designs go in `features/` as `YYYY-MM-DD-<feature>-design.md`.
