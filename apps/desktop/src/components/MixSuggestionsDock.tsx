import { useEffect, useRef, useState } from "react";
import { Play, Plus, X, GripVertical } from "lucide-react";

import type { TrackSummary } from "@dj-assistant/shared";
import { findSimilarTracks } from "../services/api";
import type { SimilarTrackResult } from "@dj-assistant/shared";

const STORAGE_KEY = "dj-assistant.mix-suggestions.width.v1";
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 240;
const MAX_WIDTH = 520;

function loadWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDTH;
    const n = Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_WIDTH;
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(n)));
  } catch {
    return DEFAULT_WIDTH;
  }
}

export function MixSuggestionsDock({
  seedTrack,
  onPlay,
  onAdd,
  onClose,
}: {
  seedTrack: TrackSummary | null;
  onPlay: (track: TrackSummary) => void;
  onAdd: (track: TrackSummary) => void;
  onClose: () => void;
}) {
  const [width, setWidth] = useState(loadWidth);
  const [results, setResults] = useState<SimilarTrackResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  useEffect(() => {
    if (!seedTrack) {
      setResults([]);
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    findSimilarTracks({ trackId: seedTrack.id, limit: 12 })
      .then((res) => {
        if (!cancelled) setResults(res.results);
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedTrack?.id]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(width));
    } catch {
      // best-effort
    }
  }, [width]);

  const startDrag = (event: React.PointerEvent) => {
    draggingRef.current = true;
    startXRef.current = event.clientX;
    startWidthRef.current = width;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const delta = startXRef.current - event.clientX;
    const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + delta));
    setWidth(next);
  };

  const endDrag = () => {
    draggingRef.current = false;
  };

  return (
    <aside
      className="absolute right-0 top-0 z-20 flex h-full shrink-0 flex-col border-l border-dj-border bg-dj-panel shadow-2xl"
      style={{ width }}
      aria-label="Mix suggestions"
    >
      <div
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-dj-accent/40"
        onPointerDown={startDrag}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize mix suggestions dock"
      >
        <GripVertical className="sr-only" />
      </div>
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-dj-border px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted">
          Mix suggestions
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close mix suggestions"
          title="Close"
          className="rounded-sm p-1 text-dj-text-muted transition hover:bg-dj-hover hover:text-dj-text"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!seedTrack ? (
          <p className="px-2 py-6 text-center text-[11px] text-dj-text-muted">
            Select a track to see mix suggestions.
          </p>
        ) : loading ? (
          <p className="px-2 py-6 text-center text-[11px] text-dj-text-muted">Loading...</p>
        ) : error ? (
          <p className="px-2 py-6 text-center text-[11px] text-dj-text-muted">
            Couldn't load suggestions.
          </p>
        ) : results.length === 0 ? (
          <p className="px-2 py-6 text-center text-[11px] text-dj-text-muted">
            No compatible tracks found.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {results.map((result) => (
              <li
                key={result.id}
                className="rounded-md border border-dj-border bg-dj-elevated p-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-dj-text">
                      {result.title || "Untitled"}
                    </p>
                    <p className="truncate text-[11px] text-dj-text-muted">
                      {result.artist || "Unknown Artist"}
                    </p>
                    {result.reasons.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {result.reasons.map((reason, index) => (
                          <span
                            key={`${result.id}-${index}`}
                            className="rounded-sm border border-dj-border bg-dj-panel px-1.5 py-0.5 text-[10px] text-dj-text-secondary"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onPlay(result)}
                      aria-label={`Preview ${result.title || "Untitled"}`}
                      title="Preview"
                      className="rounded-sm p-1 text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-accent"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onAdd(result)}
                      aria-label={`Add ${result.title || "Untitled"}`}
                      title="Add"
                      className="rounded-sm p-1 text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-accent"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
