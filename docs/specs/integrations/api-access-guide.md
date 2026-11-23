# DJ Assistant — API, Partner and Backup Access Guide

Last updated: 2026-10-23  
Status: planning / access applications not started

## 1. Purpose

This guide explains how to get API access for DJ Assistant's **Discover**, **Statistics**, and **Backup** features, what can be done with limited access, and when to contact a provider directly.

The goal is not to scrape music sites. The goal is to build a legal, reliable, partner-friendly discovery layer.

## 2. Access ladder

Start limited. Upgrade deliberately.

| Level | What it means | Examples |
|---|---|---|
| 0. Manual / link-out | No API. Open the provider's website or let the user paste a link. | Bandcamp, label promo pages |
| 1. Free/public API | Register or use a public endpoint. | MusicBrainz, ReccoBeats, Last.fm, Discogs |
| 2. Affiliate / developer API | Approved developer app with rate limits. | Spotify, SoundCloud |
| 3. Partner API | Commercial/partner agreement and technical onboarding. | Beatport, Bandcamp label/merch partners |
| 4. Full integration | Production quotas, catalog access, commercial terms. | Beatport, SoundCloud, label promo networks |

## 3. Provider matrix

| Provider | Best for | Access level | Public signup? | Contact / apply | Main limit |
|---|---|---|---|---|---|
| **ReccoBeats** | Audio features: energy, danceability, valence, tempo, key | Free API | Yes | https://reccobeats.com/docs | Not a catalog; features only |
| **MusicBrainz** | Artist/release IDs, aliases, canonical metadata | Free API | Yes | https://musicbrainz.org/doc/MusicBrainz_API | Rate limit; user-agent required |
| **Last.fm** | Similar artists, tags, scrobbles | Free API key | Yes | https://www.last.fm/api | Attribution; rate limits |
| **Discogs** | Releases, labels, catalog metadata | Free API token | Yes | https://www.discogs.com/developers | Rate limits; not audio features |
| **Spotify** | Search, metadata, links, user playlists | Developer app + quota | Yes, but restricted | https://developer.spotify.com/ | Audio features/recommendations restricted; quota extension |
| **SoundCloud** | Indie tracks, previews, free downloads when enabled | Developer app + review | Application | https://developers.soundcloud.com/ | Production access may be limited |
| **Bandcamp** | Free/purchase links, label/artist pages | Label/merch partner API | No general discovery API | https://bandcamp.com/developer and https://bandcamp.com/contact?subj=API%20Access | API for labels/fulfillment; no broad discovery API |
| **Beatport** | Electronic music catalog, charts, purchases | Partner-gated API | No public client-credentials tier | https://api.beatport.com/v4/docs/ and https://partnerportal.beatport.com/hc/en-us | Partner approval required |
| **Label promos** | Pre-release promos, free downloads, DJ feedback | Manual/partner | No universal API | Contact labels, promo pools, distributors | Fragmented; license tracking required |

## 4. Provider details

### 4.1 ReccoBeats

**Use for:** audio features that Spotify no longer provides reliably.

**What it gives:**

- acousticness
- danceability
- energy
- instrumentalness
- liveness
- loudness
- speechiness
- tempo
- valence
- key/mode in some endpoints

**Access:**

- Free API.
- No large partner approval process.
- Review terms and attribution requirements.

**Use in DJ Assistant:**

- Energy score.
- Mood/valence.
- Danceability.
- Tempo sanity check.
- Similar-track ranking.
- Statistics distributions.

**Do not:**

- Treat it as a catalog.
- Assume it replaces Spotify metadata.
- Assume the license covers redistribution of features.

### 4.2 MusicBrainz

**Use for:** canonical artist, release, recording, and label metadata.

**What it gives:**

- MusicBrainz IDs (MBIDs)
- Artist aliases
- Release groups
- Recordings
- Labels

**Access:**

- Free.
- Requires a meaningful `User-Agent`.
- Rate limited.
- No API key for basic use.

**Use in DJ Assistant:**

- Artist cleanup.
- Alias matching.
- Duplicate detection.
- Canonical metadata enrichment.

**Do not:**

- Hammer the API.
- Use it as a real-time user-facing search without caching.
- Ignore attribution.

### 4.3 Last.fm

**Use for:** similar artists, tags, and listening signals.

**Access:**

- Register for an API key.
- Review terms and attribution.
- Rate limited.

**Use in DJ Assistant:**

- Similar artist suggestions.
- Tag enrichment.
- Fallback when audio features are unavailable.

**Do not:**

- Use it as the only recommendation source.
- Ignore attribution requirements.

### 4.4 Discogs

**Use for:** release, label, and catalog metadata.

**Access:**

- API token.
- Rate limited.
- Review terms.

**Use in DJ Assistant:**

- Label cleanup.
- Release metadata.
- Catalog matching.

**Do not:**

- Use it for audio previews.
- Assume it covers every electronic release.

### 4.5 Spotify

**Use for:** search, metadata, links, and user playlists.

Important: Spotify audio features and recommendations have been restricted/deprecated for many apps. Do not build the product around them.

**Access:**

- Create a Spotify developer app.
- Development mode is limited.
- Apply for a quota extension for production.
- Extended quota requirements may include organization details and user thresholds.

**Use in DJ Assistant:**

- Search by track/artist.
- Metadata and artwork.
- Open in Spotify.
- User playlist import, if permitted.
- Link-out for discovery.

**Do not:**

- Promise Spotify audio features.
- Use Spotify as a download source.
- Assume recommendations API availability.
- Ship client secrets in the desktop app.

**Fallback:**

- ReccoBeats for features.
- Beatport/Bandcamp/SoundCloud for acquisition.
- Local library similarity for recommendations.

### 4.6 SoundCloud

**Use for:** indie tracks, previews, and free downloads when the artist enables them.

**Access:**

- Register an app at https://developers.soundcloud.com/.
- Review API terms.
- Request production access/quota.
- Availability and approval are not guaranteed.

**Use in DJ Assistant:**

- Search.
- Preview playback.
- Free download only when enabled by the artist.
- Open in SoundCloud.
- Label/artist discovery.

**Do not:**

- Download tracks that are not enabled for download.
- Scrape the site.
- Store API secrets in the frontend.
- Bypass rate limits.

**If production access is unavailable:**

- Use link-out/manual import.
- Support user-pasted SoundCloud links.
- Let users import files they legally downloaded.

### 4.7 Bandcamp

**Use for:** artist/label pages, free/purchase links, and direct support for artists.

Bandcamp's official API is for **labels and merchandise fulfillment partners**, not a general discovery API.

**Access:**

- Official API page: https://bandcamp.com/developer
- Contact: https://bandcamp.com/contact?subj=API%20Access
- Describe your intended use.
- Expect review and possible rejection if you are not a label/merchant.

**Use in DJ Assistant:**

- Open in Bandcamp.
- Paste Bandcamp links.
- Read public page metadata where terms allow.
- Label promo partnerships.
- Free/purchase license tracking.

**Do not:**

- Scrape Bandcamp.
- Build a shadow catalog from public pages.
- Assume API access will be granted.
- Bypass purchase/free-download flows.

**Fallback:**

- Manual link-out.
- User-pasted URL.
- Watch folder for legally downloaded files.
- Label promo inbox.

### 4.8 Beatport

**Use for:** electronic music catalog, charts, purchases, and DJ-relevant metadata.

Beatport API access is partner-gated. There is no general public client-credentials tier.

**Access:**

- API docs: https://api.beatport.com/v4/docs/
- Partner portal: https://partnerportal.beatport.com/hc/en-us
- Contact Beatport partnerships/affiliate team.
- Expect commercial terms, attribution, and review.

**Use in DJ Assistant:**

- Search.
- Track/release metadata.
- Charts.
- Purchase links.
- Affiliate revenue.

**Do not:**

- Scrape Beatport.
- Use leaked client IDs.
- Assume API access.
- Redistribute catalog data without permission.

**Fallback:**

- Open in Beatport.
- Affiliate links.
- User-pasted links.
- Local library discovery.

### 4.9 Label promos

**Use for:** pre-release tracks, free downloads, and DJ feedback.

There is no universal label promo API. Access is fragmented.

**Recommended model:**

1. Build a **Promo Inbox**.
2. Let users paste or forward promo links.
3. Extract label, artist, title, deadline, download link, license.
4. Send to Watch Folder.
5. Notify the user.

**Partnership routes:**

- Join label promo pools.
- Join distributor promo lists.
- Contact labels directly.
- Ask for API/feed access where available.
- Use official download links and promo codes.

**Do not:**

- Scrape private promo pages.
- Share promo credentials.
- Redistribute unreleased tracks.
- Ignore expiry dates and embargoes.

## 5. What to prepare before contacting partners

Create a partner pack:

- Legal company name and country.
- Product name and website.
- Short product description.
- Screenshots and demo video.
- Supported platforms: Windows, macOS.
- User/traffic estimates.
- Data flow diagram.
- Security overview.
- Privacy policy.
- Terms of service.
- Rate-limit and caching plan.
- Attribution plan.
- No-scraping policy.
- No-piracy policy.
- Support and incident-response process.
- Commercial model.
- Requested endpoints and quotas.

## 6. Application tracker

Use this table to track progress.

| Provider | Status | Applied | Contact | Next step |
|---|---|---|---|---|
| ReccoBeats | Not started | — | — | Read docs, test free API |
| MusicBrainz | Not started | — | — | Set User-Agent, test |
| Last.fm | Not started | — | — | Register API key |
| Discogs | Not started | — | — | Create token |
| Spotify | Not started | — | — | Create app, request quota |
| SoundCloud | Not started | — | — | Register app, request production access |
| Bandcamp | Not started | — | — | Send API access inquiry |
| Beatport | Not started | — | — | Contact partner/affiliate team |
| Label promos | Not started | — | — | Build Promo Inbox, contact labels |

## 7. Email templates

### SoundCloud

```text
Subject: API production access request — DJ Assistant

Hello SoundCloud Developer team,

We are building DJ Assistant, a Windows/macOS DJ library and set-preparation
application. We would like to use the SoundCloud API for track search,
metadata, preview playback, and discovery of tracks that artists have enabled
for download.

Could you confirm the current requirements for production API access and the
best way to apply? We can provide a product brief, screenshots, security
details, rate-limit plan, and attribution plan.

Best regards,
[Name]
[Company]
[Website]
```

### Bandcamp

```text
Subject: API access inquiry — DJ Assistant

Hello Bandcamp team,

We are building DJ Assistant, a DJ library and set-preparation application.
We would like to understand whether API access or a partner integration is
available for artist/label pages, release metadata, and free/purchase links.

We are not requesting private promo data or scraping access. If direct API
access is not available for a DJ app, we will use link-out and manual import.

Could you advise on eligibility and the correct application process?

Best regards,
[Name]
[Company]
[Website]
```

### Beatport

```text
Subject: Beatport API / affiliate partnership — DJ Assistant

Hello Beatport Partnerships team,

We are building DJ Assistant, a Windows/macOS library and set-preparation app
for DJs. We would like to discuss API and affiliate access for electronic music
search, metadata, charts, and purchase links.

We can provide a product brief, traffic estimates, security overview, privacy
policy, attribution plan, and commercial proposal.

Could you route this to the correct partner/affiliate team?

Best regards,
[Name]
[Company]
[Website]
```

### Spotify

```text
Subject: Quota extension request — DJ Assistant

Hello Spotify Developer team,

We are building DJ Assistant, a desktop DJ library and set-preparation app.
We use Spotify for search, metadata, artwork, and links, and we do not rely on
deprecated audio-features or recommendations endpoints.

Could you advise on the quota-extension requirements for a desktop application?

Best regards,
[Name]
[Company]
[Website]
```

### Label promos

```text
Subject: Promo partnership — DJ Assistant

Hello [Label / Promo team],

We are building DJ Assistant, a DJ library and set-preparation app. We would
like to explore a legitimate promo workflow for pre-release tracks, free
downloads, and DJ feedback.

We can support official promo links, expiry dates, license tracking, and
artist/label attribution. We do not scrape private pages or redistribute
unreleased music.

Would you be open to a short call?

Best regards,
[Name]
[Company]
[Website]
```

## 8. Implementation architecture

```text
DiscoverProvider
  search(query)
  similar(trackIds)
  track(id)
  preview(id)
  download(id)
  license(id)
  features(id)
  purchaseUrl(id)
```

Provider adapter fields:

```text
name
accessLevel: manual | public | developer | partner
capabilities: search, preview, download, purchase, features
rateLimit
cacheTtl
attribution
status
```

Rules:

- Never put provider secrets in the frontend.
- Use OS keychain for local secrets.
- Prefer OAuth where supported.
- Cache metadata with TTL.
- Respect rate limits and backoff.
- Log errors with redaction.
- Feature-flag each provider.
- Show provider status in Discover.
- Fall back to link-out/manual import.

## 9. Compliance checklist

- [ ] Privacy policy
- [ ] Terms of service
- [ ] Attribution rules
- [ ] Rate-limit plan
- [ ] Caching policy
- [ ] No-scraping policy
- [ ] No-piracy policy
- [ ] Download license tracking
- [ ] Promo embargo handling
- [ ] Secret storage
- [ ] User data deletion
- [ ] Incident response
- [ ] Provider review logs

## 10. Phased rollout

### Phase 0 — no partner access required

- Local library recommendations.
- ReccoBeats audio features.
- MusicBrainz metadata.
- Last.fm similar artists.
- Discogs label metadata.
- Manual link-out.
- Paste-link import.
- Promo Inbox.
- Watch Folder.

### Phase 1 — developer accounts

- Spotify developer app and quota request.
- SoundCloud app and production request.
- Beatport affiliate/partner inquiry.
- Bandcamp API inquiry.

### Phase 2 — partner access

- Beatport partner API.
- SoundCloud production quota.
- Label promo partnerships.
- Bandcamp partner integration if eligible.

### Phase 3 — full integration

- Production quotas.
- Commercial agreements.
- Catalog enrichment.
- Affiliate revenue.
- Provider SLA and monitoring.

## 11. What not to do

- Do not scrape Beatport, Bandcamp, or SoundCloud.
- Do not use leaked client IDs.
- Do not download tracks that are not enabled for download.
- Do not redistribute promo or unreleased music.
- Do not promise full catalog search before access is approved.
- Do not make Spotify audio features a core dependency.
- Do not store API secrets in the desktop frontend.
- Do not ignore attribution or rate limits.

## 12. Google Drive for Backup

Google Drive is the only cloud backup destination in v1. S3-compatible storage and Dropbox come later.

### 12.1 Why Google Drive first

- Broad consumer and Workspace availability.
- OAuth desktop flow works on Windows and macOS.
- `drive.file` scope is app-scoped and avoids full-drive access.
- Resumable uploads support large audio files.
- Provider-side encryption at rest.
- Users can revoke access from their Google Account.

### 12.2 Google Cloud setup

1. Create a Google Cloud project named `DJ Assistant`.
2. Enable the **Google Drive API**.
3. Configure the **OAuth consent screen**:
   - App name: `DJ Assistant`
   - Support email
   - Developer contact
   - Privacy policy URL
   - Terms of service URL
4. Add scope:
   - `https://www.googleapis.com/auth/drive.file`
5. Create an OAuth client:
   - Application type: **Desktop app**
   - Name: `DJ Assistant Desktop`
6. Use PKCE and a loopback redirect:
   - `http://127.0.0.1:<port>`
7. Add test users while the app is in testing.
8. Publish when ready.

### 12.3 Scope

Use `drive.file`, not `drive`.

`drive.file` lets DJ Assistant:

- Create files and folders it owns.
- Read and update those files.
- Delete those files.

It does not grant broad access to the user's entire Drive.

### 12.4 OAuth flow

- Open the system browser.
- Use PKCE.
- Redirect to a loopback listener.
- Exchange the authorization code for tokens.
- Store the refresh token in the OS keychain.
- Never store tokens in the database or logs.
- Never embed a client secret in the frontend.
- Support disconnect and revoke.
- Handle expired and revoked tokens.
- Handle account changes.

### 12.5 Folder layout

```text
DJ Assistant Backups/
  audio/
    <hash>/Track.mp3
  snapshots/
    2026-10-23_20-15-00/
      manifest.json
      library.db
      settings.json
      checksums.json
      audio-manifest.json
  latest.json
```

Rules:

- Use file and folder IDs, not names.
- Use content hashes for audio object names.
- Store hashes in `appProperties`.
- Do not rely on folder names.
- Do not upload secrets.

### 12.6 Upload behavior

- Resumable upload.
- Chunked upload.
- Exponential backoff on 429/5xx.
- Verify size and checksum.
- Skip existing objects by hash.
- Pause/resume.
- Bandwidth limit.
- Show estimated time.
- Handle quota errors.
- Handle offline.
- Handle app close.

### 12.7 Quotas and limits

Google Drive enforces API quotas and daily upload limits. Common guidance is 750 GB/day per user; verify current Google limits before shipping.

Implications:

- A full audio backup may take hours or days.
- Show an estimate before the first full upload.
- Allow scheduling outside working hours.
- Do not promise instant cloud backup.
- Do not retry aggressively on quota errors.

### 12.8 Security and privacy

- `drive.file` only.
- OS keychain for tokens.
- TLS in transit.
- Google Drive encryption at rest.
- Private app folder.
- Redact tokens in logs.
- Show the connected account.
- Allow disconnect.
- Document that app-level encryption is not enabled in v1.

### 12.9 Restore from Google Drive

- Download to staging.
- Verify size and checksum.
- Resume interrupted downloads.
- Verify the database snapshot.
- Apply the chosen restore mode.
- Record the restore in History.
- Never restore a `failed` snapshot.

### 12.10 Google Drive checklist

- [ ] Google Cloud project
- [ ] Drive API enabled
- [ ] OAuth consent screen
- [ ] `drive.file` scope
- [ ] Desktop OAuth client
- [ ] PKCE
- [ ] Loopback redirect
- [ ] Refresh token in OS keychain
- [ ] App-created folder
- [ ] Resumable upload
- [ ] Checksum verification
- [ ] Quota handling
- [ ] Token revocation handling
- [ ] Disconnect
- [ ] Restore test
- [ ] Privacy policy
- [ ] Terms of service
- [ ] No client secret in frontend

### 12.11 What not to do

- Do not request full Drive access for v1.
- Do not store tokens in plain text.
- Do not use a service account for a desktop user's Drive.
- Do not claim end-to-end encryption.
- Do not claim Google Drive is unlimited.
- Do not ignore daily upload limits.
- Do not silently skip failed uploads.
- Do not mark a backup verified before checks pass.
