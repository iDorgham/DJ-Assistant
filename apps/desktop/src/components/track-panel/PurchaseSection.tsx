import { useEffect, useRef, useState } from "react";
import type { ProviderTrackMatch, StoreLinksResponse, TrackSummary } from "@dj-assistant/shared";
import { Check, Copy, ExternalLink, PlugZap } from "lucide-react";

import { formatScore } from "../../lib/library";
import { providerMatchTracks, storeLinksForTrack } from "../../services/api";

/** Buy-links and the live, read-only Deezer lookup carried over from the inspector. */
export function PurchaseSection({ track }: { track: TrackSummary }) {
  const [links, setLinks] = useState<StoreLinksResponse | null>(null);
  const [linksLoading, setLinksLoading] = useState(true);
  const [linksError, setLinksError] = useState(false);
  const [retry, setRetry] = useState(0);

  const [match, setMatch] = useState<ProviderTrackMatch | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState(false);

  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const copyTimer = useRef<number | null>(null);
  // Only the newest lookup may write match state; a response that outlives its
  // track must not surface on the next one.
  const matchRequestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    // A different track must not show the previous track's links or match
    // while the new reads are in flight.
    setLinks(null);
    setLinksLoading(true);
    setLinksError(false);
    setMatch(null);
    setMatchError(false);
    storeLinksForTrack({ trackId: track.id })
      .then((res) => {
        if (!cancelled) setLinks(res);
      })
      .catch((err) => {
        console.error("Failed to load store links:", err);
        if (!cancelled) {
          setLinks(null);
          setLinksError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLinksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [track.id, retry]);

  useEffect(() => {
    // A lookup started for the previous track is no longer relevant.
    matchRequestRef.current += 1;
    setMatchLoading(false);
  }, [track.id]);

  useEffect(() => {
    return () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    };
  }, []);

  /** Copies a URL with a two-second confirmation, showing an error if clipboard access fails. */
  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyError(false);
      setCopiedUrl(url);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error("Failed to copy the link:", err);
      setCopyError(true);
    }
  };

  /** Looks up this track on Deezer without library writes; caught failures show a retry action. */
  const runMatch = async () => {
    const request = ++matchRequestRef.current;
    setMatchLoading(true);
    setMatchError(false);
    try {
      const res = await providerMatchTracks({ provider: "deezer", trackIds: [track.id] });
      if (request === matchRequestRef.current) setMatch(res.matches[0] ?? null);
    } catch (err) {
      console.error("Failed to match the track on Deezer:", err);
      if (request === matchRequestRef.current) setMatchError(true);
    } finally {
      if (request === matchRequestRef.current) setMatchLoading(false);
    }
  };

  // Hoisted so the copy handler sees the same narrowed value as the guard.
  const matchSourceUrl = match?.sourceUrl ?? null;

  return (
    <>
      <section>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-dj-text-secondary">
          <ExternalLink className="h-3.5 w-3.5 text-dj-success" />
          <span>Find to buy (metadata links only)</span>
        </p>
        {linksError ? (
          <p className="mt-2 text-xs text-dj-danger">
            Couldn&apos;t load store links.{" "}
            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
              className="rounded-sm px-1 text-dj-accent underline underline-offset-2 transition hover:bg-dj-hover"
            >
              Retry
            </button>
          </p>
        ) : linksLoading ? (
          <p className="mt-2 text-xs text-dj-text-muted">Loading store links…</p>
        ) : !links || links.links.length === 0 ? (
          <p className="mt-2 text-xs text-dj-text-muted">No store links for this track.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {links.links.map((link) => (
              <li
                key={link.provider}
                className="flex items-center justify-between gap-2 rounded-md border border-dj-border bg-dj-elevated p-2"
              >
                <span className="text-xs text-dj-text-secondary">{link.label}</span>
                <button
                  type="button"
                  onClick={() => copyUrl(link.url)}
                  className="flex items-center gap-1 rounded-sm border border-dj-border bg-dj-panel px-2 py-1 text-[11px] text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
                  title={link.url}
                >
                  {copiedUrl === link.url ? (
                    <Check className="h-3 w-3 text-dj-success" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiedUrl === link.url ? "Copied" : "Copy link"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {copyError && (
          <p className="mt-1.5 text-[11px] text-dj-danger">Couldn&apos;t copy the link.</p>
        )}
        <p className="mt-2 text-[11px] text-dj-text-muted">
          Links open the store&apos;s own search page. No audio is fetched.
        </p>
      </section>

      <section>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-dj-text-secondary">
          <PlugZap className="h-3.5 w-3.5 text-dj-accent" />
          <span>Match on Deezer (live read, no key)</span>
        </p>
        {!match && !matchLoading && (
          <button
            type="button"
            onClick={runMatch}
            className="mt-2 rounded-md border border-dj-border bg-dj-elevated px-2.5 py-1.5 text-xs text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
            title="ISRC-exact first, then fuzzy search. Writes nothing."
          >
            Match this track
          </button>
        )}
        {matchLoading && <p className="mt-2 text-xs text-dj-text-muted">Matching…</p>}
        {matchError && (
          <p className="mt-2 text-xs text-dj-danger">
            Couldn&apos;t reach the provider.{" "}
            <button
              type="button"
              onClick={runMatch}
              className="rounded-sm px-1 text-dj-accent underline underline-offset-2 transition hover:bg-dj-hover"
            >
              Retry
            </button>
          </p>
        )}
        {match && (
          <div className="mt-2 rounded-md border border-dj-border bg-dj-elevated p-2 text-xs">
            {match.providerId ? (
              <>
                <p className="truncate text-dj-text">
                  {match.title} — {match.artist}
                </p>
                <p className="mt-0.5 text-[11px] text-dj-text-muted">
                  {match.album ?? "Unknown release"} · {match.status} ·{" "}
                  {formatScore(match.confidence)}
                </p>
                {matchSourceUrl && (
                  <button
                    type="button"
                    onClick={() => copyUrl(matchSourceUrl)}
                    className="mt-1.5 flex items-center gap-1 rounded-sm border border-dj-border bg-dj-panel px-2 py-1 text-[11px] text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
                    title={matchSourceUrl}
                  >
                    {copiedUrl === matchSourceUrl ? (
                      <Check className="h-3 w-3 text-dj-success" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span>{copiedUrl === matchSourceUrl ? "Copied" : "Copy Deezer link"}</span>
                  </button>
                )}
              </>
            ) : (
              <p className="text-dj-text-muted">No Deezer match for this track.</p>
            )}
            <p className="mt-1.5 text-[11px] text-dj-text-muted">
              Matching stays read-only; nothing is written to the library.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
