# Stage 1 — manual running-window QA

**Status:** **NOT EXECUTED** — shell implemented, native acceptance pending (2026-10-23)
**Scope:** the Definition-of-Done gate for Stage 1 — Foundation and shell in
`docs/plan/06-delivery/implementation-slices.md`.
**Implementation under test:** six primary tabs, top-bar search/Import
Center/Inbox/backup status, persistent player dock, Settings skeleton, typed
view registry, error boundary and redacted renderer logging.

---

## 1. How to run it

The QA must happen in the **Tauri shell**, not a browser tab:

- `pnpm dev:desktop` starts **only the Vite dev server**. Opened in a browser,
  the front-end falls back to the mock API and proves nothing about the real
  shell, database or player.
- Start the desktop app with `pnpm tauri dev` from `apps/desktop`.
- Before launching, copy the live library DB/WAL/SHM. Do not run a performance
  fixture against the real library.
- The browser smoke pass (all route values, six tabs, shortcuts, settings links)
  is useful for a quick regression but is **not** acceptance evidence.

## 2. Section A — Shell and navigation

| # | Action | Expected result |
| --- | --- | --- |
| A1 | Launch the app | The window opens on the last saved primary view, or Library on first run |
| A2 | Click Library, Playlists, Discover, Statistics, Publish and Settings | Each tab opens; Playlists/Discover/Statistics/Publish show an honest planned view, not a blank or fake screen |
| A3 | Check the top bar | Search library, Import Center, Inbox and backup status are present; no old six-view switcher remains |
| A4 | Click Import Center | The Import Center route opens; the active state is visible |
| A5 | Click Inbox | The “Inbox is clear” empty state opens with a working Go to Library action |
| A6 | Click backup status | The Backup route opens; the status remains “not set up” |
| A7 | Open Settings | Appearance, Library and import, DJ applications, Backup and About sections are visible |
| A8 | Use Settings links | Import, Analysis, Player workspace, Sync and Backup each open a real route |
| A9 | Press `Ctrl/Cmd+1..6` | The six primary tabs switch in order |
| A10 | Press `Ctrl/Cmd+I` and `Ctrl/Cmd+,` | Import Center and Settings open |
| A11 | Press `Tab` from the top of the window | Focus is visible and the skip-to-main-content link can be reached |
| A12 | Inspect every route in the primary and utility registries | No route shows “View not found” |

## 3. Section B — Player dock and restoration

| # | Action | Expected result |
| --- | --- | --- |
| B1 | Open the player in Mini, then switch tabs | The dock stays visible and keeps its track/position |
| B2 | Expand to Full, then switch tabs | The chosen presentation remains stable |
| B3 | Hide the player, switch tabs, then show it | The last visible presentation is restored |
| B4 | Change view, close the app, relaunch | The last primary view is restored |
| B5 | Collapse and expand the left navigation | The choice persists across relaunch |

## 4. Section C — Error boundary and logging

| # | Action | Expected result |
| --- | --- | --- |
| C1 | Trigger a renderer exception in a dev-only test surface | The app shows the generic recovery screen; the rest of the window is not left half-rendered |
| C2 | Inspect the console entry | It contains a redacted error, not a raw token, email address or user-home path |
| C3 | Use Try again / Reload app | Recovery works or the window reloads cleanly |

## 5. Section D — 30,000-track fixture

**Blocker:** the repository has no 30,000-track fixture and the app has no
documented app-data-dir override. Do not point this test at the live library.

| # | Action | Expected result |
| --- | --- | --- |
| D1 | Create a separate fixture DB with 30,000 tracks after backing up the live DB | The fixture opens in the app without touching real data |
| D2 | Load Library and switch primary tabs | No multi-second freeze, no unresponsive window |
| D3 | Scroll and use the first 200-row page | The shell remains responsive |
| D4 | Record the machine, build and timings | The result is attributable and repeatable |

Until D1–D4 pass, Stage 1 is **not acceptance-complete**. Stage 2 owns the
virtualized table and the real 30,000-track performance proof.

## 6. Result record

| Section | Result | Date | Notes |
| --- | --- | --- | --- |
| A — Shell and navigation | NOT RUN | — | — |
| B — Player and restoration | NOT RUN | — | — |
| C — Error boundary and logging | NOT RUN | — | — |
| D — 30,000-track fixture | BLOCKED | — | No fixture or safe DB override yet |
