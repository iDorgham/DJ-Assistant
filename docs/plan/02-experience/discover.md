# Discover

Last updated: 2026-10-23  
Status: Locked direction; download flow and v1 sources confirmed; provider details open

## 1. Purpose

Discover helps the user find music that fits their library, with a bias toward **free downloads, Bandcamp, SoundCloud and label promos** first.

Discover is not a generic music store and not a scraper. It is a library-aware discovery layer with clear source, license and attribution.

## 2. Principles

- Local-first recommendations.
- Library-aware, not generic charts.
- Free and legally downloadable music first.
- Source, license, quality and attribution always visible.
- Link out when the license does not allow in-app playback or download.
- Never download a track that is not explicitly enabled for download.
- Never scrape a catalog.
- Weekly digest, not a firehose.

## 3. Views

```text
Discover
  For You
  Free Downloads
  Sources
  Watchlist
```

### For You

Recommendations based on:

- Library genres, styles and moods.
- Artists already in the library.
- Labels in the library.
- BPM and key ranges.
- Energy profile.
- Play history and ratings.
- Wishlist.
- Free downloads and promos.

Each recommendation explains why:

```text
Because you play Deep House and saved 3 tracks from this label.
```

### Free Downloads

Priority sources:

1. Bandcamp free / name-your-price releases.
2. SoundCloud tracks with download enabled.
3. Label promos and promo pools.
4. Artist/label newsletters and links.
5. Later: Beatport and other partner sources.

Card fields:

- Title
- Artist
- Label
- Genre / style
- BPM / key (if known)
- Duration
- Source
- License
- Price
- Format / quality
- Release date
- Attribution
- Download enabled
- Expiry / embargo

### Sources

- Connected providers.
- Connection status.
- Capabilities.
- Rate limits.
- Attribution requirements.
- Last sync.
- Enable/disable.

### Watchlist

Tracks the user wants to revisit:

- Artist
- Label
- Genre
- Source
- Release date
- Price
- Download status
- Notes

Watchlist is local. It does not imply a streaming subscription.

## 4. Recommendation model

Inputs:

- Library metadata.
- Tags.
- BPM/key.
- Energy.
- Ratings.
- Play history.
- Playlists.
- Saved/free downloads.
- Similar artists from Last.fm or MusicBrainz.
- Audio features from ReccoBeats.
- Label and release metadata.

Outputs:

- Similar to library.
- More from this artist.
- More from this label.
- Fits this playlist.
- Free download.
- Promo.
- Rediscover.

Rules:

- Show the reason.
- Allow “not interested”.
- Do not recommend the same track repeatedly.
- Do not recommend tracks already in the library unless there is a new version.
- Do not hide the source.

## 5. Cards and actions

```text
┌──────────────────────────────────────────────┐
│ [artwork]  Track title                       │
│            Artist · Label                    │
│            Deep House · 124 BPM · 6A         │
│            Bandcamp · Free / name your price │
│            License: artist-approved download │
│                                              │
│ [ Preview ] [ Open source ] [ Save ]         │
│ [ Download ] [ Add to Inbox ] [ Ignore ]     │
└──────────────────────────────────────────────┘
```

Actions:

- **Preview** — only when the provider permits it.
- **Open source** — always available.
- **Save** — add to Watchlist.
- **Download** — only when explicitly enabled.
- **Add to Inbox** — queue for review/import.
- **Ignore** — hide and learn.
- **Add to playlist** — only after the track is in the library.

## 6. Free download rules

A free download is valid only when:

- The source explicitly enables download.
- The license or terms permit personal use.
- The source is recorded.
- The download URL is recorded.
- The file hash is recorded.
- Attribution is displayed.
- The user confirms the download.
- The file enters the Import Center/Inbox for review.
- No download is auto-imported.

Do not:

- Bypass a paywall.
- Download a stream.
- Use a leaked URL.
- Redistribute promo or unreleased music.
- Scrape a page to find hidden downloads.
- Treat “free stream” as “free download”.

## 7. Promo handling

Promo records include:

```text
label
promoter
release_date
embargo_until
allowed_use
feedback_due
source_url
contact
status
```

Rules:

- Do not publish a promo before embargo.
- Do not share promo files.
- Track feedback deadlines.
- Show promo status in Inbox.
- Remove expired promos from recommendations.

## 8. Weekly digest

Default: weekly.

Contents:

- New free downloads.
- New releases from followed artists/labels.
- Promos nearing embargo or feedback deadline.
- Watchlist changes.
- A small number of high-confidence recommendations.

Rules:

- One digest, not per-item notifications.
- The user can change frequency.
- The digest links to Discover, not a separate feed.
- Dismissing the digest does not delete items.

## 9. Provider access

See `api-access-guide.md`.

Access ladder:

0. Manual/link-out
1. Free/public API
2. Developer/affiliate API
3. Partner API
4. Full integration

v1 priority:

- Manual/link-out.
- Free APIs.
- Bandcamp/SoundCloud/provider pages where allowed.
- Label promos.
- Partner access later.

Do not promise full catalog search before access is approved.

## 10. Discover and the library

- A downloaded track enters the Import Center/Inbox for review.
- No download is auto-imported.
- The user can choose Quick or Curated import after review.
- The track is not added to the library until imported.
- Duplicate checks run before import.
- Source and license metadata are stored.
- Discover does not create a parallel library.
- Recommendations update after import.

## 11. Filters

- Genre / Subgenre
- Style
- Mood
- BPM range
- Key
- Energy
- Price (free, name-your-price, paid)
- Source
- Format
- Quality
- Release date
- License
- Download enabled
- Promo status

## 12. Empty and error states

| State | Message |
|---|---|
| No providers | “Connect a source or browse free downloads.” |
| No recommendations | “Add more tags and playlists to improve recommendations.” |
| Provider offline | “This source is unavailable. Try again later.” |
| Rate limited | “Provider rate limit reached. Showing cached results.” |
| Download unavailable | “The source does not allow download.” |
| License unknown | “Check the source before downloading.” |

## 13. Decisions and open questions

Confirmed:

- Free downloads land in the Inbox/Import Center for review.
- No download is auto-imported.
- Discover v1 sources: Bandcamp free/name-your-price, SoundCloud download-enabled tracks, label/promoter promos. Manual/link-out first; no scraping; no Beatport dependency.
- Discover downloads are review-only and never auto-imported.

Still open:

1. Is in-app preview allowed for each source, or link-out only?
2. Should Discover support streaming playback at all?
3. Which recommendation signals are mandatory vs optional?
4. Should Watchlist be a separate view or a filter?
5. Should Discover have a “fits this playlist” mode in v1?
6. What is the weekly digest day/time?
