# Phase 0 capability map (T2.1.10)

## RowContextMenu.tsx (current)
- Props: x,y,trackTitle,onEditTags,onClose,restoreFocus?
- Behavior: viewport clamping, focus on first item on open, focus restore on close unless actionTakenRef.current true (editor takes focus), click-outside closes on mousedown capture, Escape closes with stopPropagation/preventDefault, ArrowDown/ArrowUp navigate with wrapping, role="menu", aria-label includes trackTitle, onContextMenu prevents default.
- Shipped: only "Edit tags..." (enabled) - calls onEditTags() then onClose(), sets actionTakenRef=true.
- Stub: "Fix tags" disabled with title "Tag cleaning arrives with the Tag Surgeon (T2.2)".

## App.tsx integration
- Context menu state: contextMenu = {track: TrackSummary, x:number, y:number} | null. handleRowContextMenu sets it. openMetadataEditor sets editorTrack. restoreFocus passes () => contextRowRef.current?.focus().
- Row wiring: onContextMenu on table rows.
- Rating: setTrackRating exists, handleSetRating calls it with trackIds and rating ?? 0; undo toast exists. StarRating exists.
- Columns: handleToggleColumn exists, library-columns model with identity-column guard exists. ColumnPicker wired.
- Play: handlePlayTrack sets playingTrack and shows mini dock if hidden. No explicit enqueue/queue API found.
- Analysis: analyzeLibrary exists (queues analysis). Progress events exist.
- Similar/Mix: findSimilarTracks exists (local similarity).
- Playlists: No local playlist CRUD APIs found. Only provider export playlist API exists.
- Remove from library: No delete/remove commands found.
- Clipboard: No clipboard API found in app code.
- Reveal in Finder: No opener/reveal APIs/plugins found (only dialog plugin).
- Backup/snapshot: Undo snapshots via skill_runs for metadata writes only. No generic backup snapshot API for remove-from-library.

## Capability table
| Canonical action | Backing capability | Available? | Proposed handler | Batch | Blocker |
|---|---|---|---|---|---|
| Play | handlePlayTrack + player | PARTIAL | Trigger playback for selection/track; need selection resolution and missing-file handling. | A1 | Need to confirm multi-select behavior and file existence checks. |
| Edit tags... | openMetadataEditor | YES | Shipped. | - | - |
| Fix tags | T2.2 Tag Surgeon | NO | Leave disabled with tooltip. | - | Per requirements. |
| Analyze | analyzeLibrary command + events | YES | Call analyzeLibrary with trackIds. | C1 | Backend exists; may be gated per context. |
| Rate | setTrackRating/updateTrackMetadata + undo toast | YES | Add Rate submenu (1-5, Clear) with batch support. | A5 | Follow existing batch rating contract. |
| Add to playlist/set | No local playlist APIs | NO | Not in tree. | B1 | Blocker - no APIs. |
| Find in playlists | No membership query | NO | Not in tree. | B2 | Blocker - no APIs. |
| Mix suggestions | findSimilarTracks | PARTIAL | Could open similar tracks surface; need UI wiring. | C2 | May need to open inspector/similar surface. |
| View columns toggles | handleToggleColumn + library-columns (identity guard) | YES | Submenu for togglable columns respecting guard. | A4 | Respect identity-column guard. |
| Reveal in Finder | No opener/reveal APIs/plugins | NO | Not in tree. | - | Blocker - need Rust command/plugin. |
| Copy path | No clipboard API | NO | Not in tree. | A2 | Blocker - need clipboard mechanism. |
| Remove from library | No delete/remove + no backup snapshot API | NO | Not in tree. | C3 | Blocker - needs confirmation, backup snapshot, transaction, undo/fk handling. |
