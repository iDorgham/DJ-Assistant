# Phase 0 capability map (T2.1.10)

**Re-verified 2026-11-08** against `App.tsx`, `RowContextMenu.tsx` and `commands.rs`.
The `Available?` column is the truth: `YES` means the capability is shipped and wired,
`PARTIAL` means the backend exists but the surface does not, `NO` means it is not in the
tree. Citations point at the `pub async fn` / `const` line in the current working tree.

## RowContextMenu.tsx (current)
- Props (`RowContextMenu.tsx:48-87`): x, y, trackTitle, onEditTags, onClose, restoreFocus?, onRate?, currentRating?, onPlay?, playDisabled?, playDisabledReason?, columns?, onToggleColumn?, canHideColumnFn?, onReveal?, onCopyPath?, onRemove?. `playDisabled` and `playDisabledReason` are optional component props, but `App.tsx` passes `false` and `undefined`; Library menu Play stays enabled for unreadable tracks, with no reason shown. There is no reorder prop.
- Behavior: viewport clamping (`180-193`), focus on the first item on open and focus restore on **every** closing path via `restoreFocusRef` (`202-208`) — the old `actionTakenRef` exemption is gone, and a dialog that opens instead takes the focus in its own later effect; click-outside closes on mousedown capture (`212-219`), Escape closes, ArrowDown/ArrowUp navigate with wrapping, `role="menu"`, `aria-label` includes trackTitle, `onContextMenu` prevents default.
- Rows and order come from `MENU_LAYOUT` (`lib/library-menu.ts:87`), rendered at `401`. Live: Play (always enabled in the Library integration), Edit tags…, the inline Rate stars (1–5 plus Clear; clicking the current rating clears it, `267-311`), the column-toggles submenu, Reveal, Copy path and Remove (`actions`, `253-259`).
- Disabled stubs carry their reason in the tooltip via `isDisabled` / `itemTooltip`: Analyze, Fix tags ("Tag cleaning arrives with the Tag Surgeon (T2.2)"), Add to playlist…, Add to set…, Find in playlists…, Mix suggestions… and the two online-search rows. They are `aria-disabled`, not `disabled`, so they stay focusable and explain themselves.

## App.tsx integration
- Context menu state: contextMenu = {track: TrackSummary, x:number, y:number} | null. `handleRowContextMenu` (`App.tsx:2084`) sets it. `openMetadataEditor` (`App.tsx:2197`) sets editorTrack. restoreFocus passes () => contextRowRef.current?.focus().
- Row wiring: onContextMenu on table rows (`App.tsx:3014`).
- Rating: `set_track_rating` exists (`commands.rs:825`); `handleSetRating` (`App.tsx:1971`) calls it with trackIds and `rating ?? 0`; undo toast exists. `StarRating` exists.
- Columns: `handleToggleColumn` (`App.tsx:2369`) exists, `library-columns` model with identity-column guard exists. `ColumnPicker` wired (`App.tsx:2785`).
- Play: `handlePlayTrack` (`App.tsx:1508`) selects the track for the player and shows the Mini dock if hidden. The preview currently produces a synthetic beat rather than playing the track's audio; real track playback remains pending (T2.4).
- Analysis: `analyze_library` exists (`commands.rs:376`) and progress events exist, but the menu row is a deliberate disabled stub — the backend being ready is not the surface being live.
- Similar/Mix: `findSimilarTracks` exists (local similarity); no Mix Suggestions surface is wired to it.
- Playlists: No local playlist CRUD APIs found. Only provider export playlist API exists.
- Remove from library: `remove_tracks` (`commands.rs:964`) soft-deletes with a transactional `skill_runs` undo snapshot; `undo_remove_tracks` (`commands.rs:1041`) is the undo endpoint; `restore_tracks` (`commands.rs:1137`) is the deliberate way back once the toast is gone, and it writes its own undo snapshot. `list_removed_tracks` (`commands.rs:1099`) is the read behind the Removed view.
- Clipboard: `navigator.clipboard.writeText` (`App.tsx:2114`) used by `handleCopyPath` (`App.tsx:2111`).
- Reveal in Finder: `reveal_in_file_manager` (`commands.rs:1224`) wired to `handleRevealTrack` (`App.tsx:2124`).
- Backup/snapshot: Undo snapshots via `skill_runs` for metadata writes, rating, energy, tag sets, soft-remove and restore.

## Capability table
| Canonical action | Backing capability | Available? | Handler | Batch | Blocker |
|---|---|---|---|---|---|
| Play | `handlePlayTrack` + player | PARTIAL | Selects the track and reveals the dock; preview uses a synthetic beat, not the track audio. Library menu Play stays enabled for unreadable files and shows no reason; real track playback is pending (T2.4). | A1 | Real audio playback (T2.4) |
| Edit tags... | `openMetadataEditor` | YES | Shipped. | - | - |
| Fix tags | T2.2 Tag Surgeon | NO | Disabled stub with tooltip. | - | Per requirements. |
| Analyze | `analyze_library` command + events | PARTIAL | Backend ready; the menu row stays a disabled stub. | C1 | Surface deliberately deferred (T2.1.10). |
| Rate | `set_track_rating` + undo toast | YES | Shipped: inline 1–5 stars plus Clear. | A5 | - |
| Add to playlist/set | No local playlist APIs | NO | Not in tree. | B1 | Blocker - no APIs. |
| Find in playlists | No membership query | NO | Not in tree. | B2 | Blocker - no APIs. |
| Mix suggestions | `findSimilarTracks` | PARTIAL | `OverviewTab` invokes it and renders selectable “Similar tracks (local mix-compatibility)” results; no dedicated Mix dock yet. | C2 | Needs the T2.1.11 dock. |
| View columns toggles | `handleToggleColumn` + `library-columns` (identity guard) | YES | Shipped: submenu respecting the identity guard. | A4 | - |
| Reveal in Finder | `reveal_in_file_manager` (`commands.rs:1224`) | YES | `handleRevealTrack` (`App.tsx:2124`). | - | - |
| Copy path | `navigator.clipboard.writeText` (`App.tsx:2114`) | YES | `handleCopyPath` (`App.tsx:2111`). | - | - |
| Remove from library | `remove_tracks` + undo (`commands.rs:964`, `1041`) | YES | `openRemoveConfirm` (`App.tsx:2138`) → `handleRemoveConfirmed` (`App.tsx:2147`). | C3 | - |
