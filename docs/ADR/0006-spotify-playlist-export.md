# ADR-0006: Spotify Playlist Export (Desktop PKCE, Metadata Only)

**Status:** Accepted  
**Date:** 2026-10-14  
**Deciders:** Product + Engineering

## Context

DJs often want to take a prepared set outside DJ software — as a streaming playlist
they (or a B2B partner) can review, share with a promoter, or listen to on the way to
a gig. The canonical spec's long-standing Spotify strategy covers **metadata-only
import** (match library tracks to Spotify to enrich metadata / link to buy) and
explicitly forbids **audio** download, streaming playback, or storage.

We want to add the reverse direction — publish a built set to the DJ's own Spotify
account as a real Spotify playlist — without violating the local-first,
non-destructive, no-piracy posture and without standing up a backend.

Key constraints:

- The cloud control plane is **optional**; the core prep workflow must work without it.
- The app must never download, stream, store, or upload audio, and must not enable piracy.
- Only playlists a user owns or collaborates on are addressable via the Spotify Web API.

## Decision

Add **Spotify Playlist Export** as a **post-MVP** feature (not part of the 90-day MVP),
implemented **desktop-only**:

- **Auth:** OAuth 2.0 Authorization Code with **PKCE** (RFC 7636), run in the desktop
  app; a public client ID is embedded at build time; **no client secret**; loopback
  redirect (`http://127.0.0.1:<port>/callback`) or custom URI scheme; access/refresh
  tokens are stored in the **OS keychain** and refreshed locally.
- **Scopes:** minimal — `playlist-modify-private` by default; `playlist-modify-public`
  only when the DJ opts into a public playlist; `playlist-read-private` only when
  updating an existing playlist. No library/email scopes.
- **Matching:** ISRC-first (Spotify `isrc:` search) → fuzzy fallback on normalized
  title/artist/album with a ±3 s duration tolerance → confidence tiers; high confidence
  auto-adds, medium/low go to a **review queue**, unmatched are reported with
  "search Spotify manually" / "skip".
- **Writes:** create a playlist and add tracks (chunked, ≤100 URIs per request). Handle
  429 + `Retry-After` with exponential backoff and 401 → token refresh.
- **Privacy:** only track metadata and search queries leave the device; no audio.
  Disconnect/revocation removes the stored tokens.
- **Reversibility:** creating a playlist is an external side effect, so it is previewed,
  explicitly confirmed, recorded, and audited; unfollowing only removes it from the DJ's
  library—it does not delete the playlist or revoke access to a public playlist.
- **Data:** desktop-local SQLite tables `streaming_accounts`, `streaming_exports`,
  `streaming_matches`. No cloud tables are required.

## Consequences

**Positive**

- One more way to take a prepared set out of the tool — shareable and listenable, with
  zero audio risk.
- No backend, no secret to manage, and no new cloud dependency; fits the local-first posture.
- Minimal scopes and OS-keychain storage keep the blast radius small; revocation is a
  first-class action.

**Negative**

- A third-party account and network round-trips are required; results depend on Spotify's
  catalog and rate limits.
- Matching is inherently imperfect (remixes, edits, exclusives) and needs a review UI.
- Creating a public playlist is externally visible — must default to private and confirm.

**Neutral**

- Introduces a "Streaming export" category distinct from the deterministic file exporters.
- May later be mirrored to the cloud for shared/B2B sync, but that is not required.

## Alternatives Considered

- **Cloud-brokered OAuth (Fastify holds the client secret)** — rejected for now: requires
  the optional cloud, adds a secret to manage, and breaks standalone desktop use.
  Revisit if web sign-in is needed.
- **Hybrid / both (PKCE + optional cloud)** — deferred; local-first PKCE is the default
  and a cloud mirror is not needed for v1 of the feature.
- **Manual export of a track list (CSV) for the user to import into Spotify** — rejected:
  poor UX and no reliable matching/verification.
- **Audio download / offline streaming copy** — rejected outright: violates the non-goals
  and enables piracy.
