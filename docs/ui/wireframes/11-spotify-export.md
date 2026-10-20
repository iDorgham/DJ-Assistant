# Wireframe — Spotify Playlist Export (11)

**Phase:** Post-MVP · 📋 Planned
**See also:** [Screens & Flows §4.10 / §5.8](../12-SCREENS-AND-FLOWS.md) · [UX Principles §4](../00-OVERVIEW.md) · [Export](./07-export.md) · [Export flow diagram](../../diagrams/16-spotify-playlist-export.md)

Publishes a built set (or any playlist) to the DJ's **own** Spotify account as a real Spotify
playlist, using **metadata only**. It is the one export path that touches the network. Audio is
never downloaded, streamed, stored, or uploaded.

---

## Wireframe — not connected

```
┌ Spotify Playlist Export ───────────────────────────────────────────────────────────────────────────────────┐
│  {1} Publish a set (or any playlist) to your own Spotify account · metadata only, no audio                 │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {2} Not connected                                                                                         │
│      Connect Spotify to publish playlists. Sign-in opens in your browser and returns to the app.           │
│                                                                                                            │
│      Requested scopes:                                                                                     │
│        • playlist-modify-private   (default)                                                               │
│        • playlist-modify-public    (opt-in)                                                                │
│                                                                                                            │
│      Only track metadata and search queries leave this device. Audio is never                              │
│      downloaded, streamed, stored, or uploaded.                                                            │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {3} [ Connect Spotify ]                                                                        [ Cancel ] │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe — publishing (matching progress)

```
┌ Spotify Playlist Export ───────────────────────────────────────────────────────────────────────────────────┐
│  {4} Publishing "Arena Club — Peak Hour" · 28 tracks                                                       │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {5} ✓ Connected as dj.name@example.com                                                     [ Disconnect ] │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│      Matching tracks…                                                                                      │
│      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░   18 / 28                                                    │
│      {6} Deep Horizon      ISRC match           ✓ high    0.99                                             │
│          Solar Wind        title/artist fuzzy   ~ medium  0.71                                             │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {7} Matching runs while you keep working — you can cancel                                      [ Cancel ] │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe — match review

```
┌ Spotify match review ──────────────────────────────────────────────────────────────────────────────────────┐
│  {8} 28 tracks · 19 auto-matched · 6 to review · 3 unmatched                                               │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {9} Auto-matched (high confidence) — added automatically                                                  │
│      ✓ 19 tracks   e.g. "Deep Horizon" → "Deep Horizon — Kael" (ISRC · 0.99)                               │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {10} Review (medium / low confidence)                                                                     │
│       Solar Wind     ~ 0.71 → "Solar Wind (Radio Edit)" — Nova   [ Accept ] [ Other… ] [ Skip ]            │
│       Afterglow      ~ 0.54 → "Afterglow" — K. Rivers             [ Accept ] [ Other… ] [ Skip ]           │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {11} Unmatched (no candidate found)                                                                       │
│       Midnight Drive                     [ Search Spotify… ]  [ Skip ]                                     │
│       Echoes                             [ Search Spotify… ]  [ Skip ]                                     │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {12} [ Publish 25 matches ]                                                                    [ Cancel ] │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe — result (open + undo)

```
┌ Spotify Playlist Export ───────────────────────────────────────────────────────────────────────────────────┐
│  {13} ✓ Published "Arena Club — Peak Hour"                                                                 │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│      25 tracks added · 3 skipped · playlist visibility: private                                            │
│  {14} Open in Spotify:   open.spotify.com/playlist/37i9dQZ…                                                │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {15} Metadata only — no audio was uploaded. Source files are untouched.                                   │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  [ Delete playlist ]   {16} removes the created playlist (undo)                                   [ Done ] │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe — rate limited / failed

```
┌ Spotify Playlist Export ───────────────────────────────────────────────────────────────────────────────────┐
│  {17} ▲ Publishing paused — Spotify rate limit reached                                                     │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│      Spotify asked us to slow down (429). 21 of 25 tracks were added.                                      │
│      Retry in 00:30, or add the remaining tracks later from the result panel.                              │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  [ Retry now ]                                                                                   [ Close ] │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Annotations

| # | Element | Behaviour |
|---|---------|-----------|
| {1} | Header | What the export does: publishes to the DJ's own Spotify account, metadata only |
| {2} | Not-connected state | Explains browser sign-in, lists requested scopes, restates that only metadata is sent |
| {3} | Connect | Opens the browser OAuth flow and returns to the app on success |
| {4} | Publish header | The set being published and its track count |
| {5} | Connected account | Shows who is signed in; **Disconnect** revokes from here or from Settings |
| {6} | Match progress | Current track and match reason (ISRC vs. fuzzy) with its confidence score |
| {7} | Background copy | Matching runs off the UI thread and is cancellable |
| {8} | Review summary | Counts: auto-matched · to review · unmatched |
| {9} | Auto-matched | High-confidence matches added automatically, with an example |
| {10} | Review row | Medium/low match with **Accept** / **Other…** (pick a different match) / **Skip** |
| {11} | Unmatched row | No candidate: **Search Spotify…** (manual) or **Skip** |
| {12} | Publish | Creates the playlist and adds every accepted/auto match |
| {13} | Result | Confirms the playlist and what was added/skipped |
| {14} | Open in Spotify | Link that opens the created playlist in Spotify |
| {15} | Guarantee | Restates metadata-only and that source files are untouched |
| {16} | Delete playlist | Removes the created playlist — the undo for the whole operation |
| {17} | Failure | Names the cause (e.g. `429` rate limit) and what was already added, with a retry |

### Match rules

| Step | Rule |
|------|------|
| 1. ISRC | Exact ISRC match wins outright when the local file has one |
| 2. Fuzzy | Otherwise normalised title / artist / album compared against Spotify search results |
| 3. Duration | ±3 s tolerance filters fuzzy candidates |
| 4. Confidence | Score from the above → **high** (auto-add) · **medium / low** (review) · none (unmatched) |

### Scopes

| Scope | When | Why |
|-------|------|-----|
| `playlist-modify-private` | Default | Creates/edits a private playlist; the minimum needed |
| `playlist-modify-public` | Opt-in | Only if the DJ explicitly wants a public playlist |

---

## States

| State | Behaviour |
|-------|-----------|
| **Not connected** | **Connect Spotify** offered; scopes + metadata-only note shown; file exports are unaffected |
| **Connecting** | Browser opens for sign-in; app shows a return-to-app hint; cancellable |
| **Connected** | Account shown; publish available; **Disconnect** available |
| **Publishing** | Matching progress (matched / total); UI stays responsive; cancellable |
| **Review** | Medium/low and unmatched tracks require a decision before publishing |
| **Published** | Success with an open-in-Spotify link, track counts, and **Delete playlist** |
| **Rate limited / failed** | Names the cause and what was already added; offers **Retry** |
| **Disconnected** | Tokens removed from the OS keychain; created playlists in Spotify are left untouched |

---

## Interactions

- **Connect Spotify** → opens the browser for OAuth 2.0 Authorization Code with PKCE
  (embedded public client ID, no client secret); the app receives the callback and stores
  tokens in the OS keychain.
- **Publish to Spotify** → runs matching, then shows the review screen before creating anything.
- **Accept / Other… / Skip** → resolves a single review row; **Other…** opens a candidate list.
- **Search Spotify…** → opens a manual search for an unmatched track.
- **Publish N matches** → creates the playlist and adds the accepted/auto tracks.
- **Open in Spotify** → opens the created playlist in the browser/desktop app.
- **Delete playlist** → deletes the created playlist (undo for the whole operation).
- **Disconnect** → revokes access and removes stored tokens (confirmation required).

---

## Accessibility obligations

- Match confidence is shown as text (`high`, `medium`, `low`) **and** a score, never colour alone.
- Review and unmatched lists are real lists; each row's actions are labelled buttons in order.
- Progress for matching is announced politely and cancelled with `Esc`.
- Scope names and the "metadata only, no audio" guarantee are readable text, not tooltips.
- The result and any failure are announced; the retry action is reachable by keyboard.

---

## Notes

- **Post-MVP.** Not part of the 90-day MVP; specified here so the Export surface is designed once.
- **Metadata only.** Only track metadata and search queries leave the device; audio is never
  downloaded, streamed, stored, or uploaded.
- **Reversible.** The created playlist can be deleted (undo); publishing never touches source files.
- **Minimum scopes** by default (`playlist-modify-private`); public is opt-in.
- OAuth 2.0 **Authorization Code + PKCE** runs entirely in the desktop app (public client, no secret).
