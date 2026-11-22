/**
 * Wording and small decisions for Library › Maintain: duplicates (T2.3.1),
 * versions (T2.3.2) and the Library Health Score (T2.3.3). Pure, so they are
 * unit tested without a DOM; the rules themselves live in `dj-assistant-core`.
 */
import type {
  DuplicateReason,
  HealthCategoryView,
  MaintainTrack,
  VersionKind,
} from "@dj-assistant/shared";

export type MaintainTab = "health" | "duplicates" | "versions";

export const MAINTAIN_TABS: { id: MaintainTab; label: string }[] = [
  { id: "health", label: "Health" },
  { id: "duplicates", label: "Duplicates" },
  { id: "versions", label: "Versions" },
];

/** `m:ss`, or an en dash for an unknown length. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "–";
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** "FLAC", "MP3 · 320 kbps", or "" when nothing is known. */
export function formatQuality(track: Pick<MaintainTrack, "format" | "bitrateKbps">): string {
  const parts: string[] = [];
  if (track.format) parts.push(track.format.toUpperCase());
  if (track.bitrateKbps && track.bitrateKbps > 0) parts.push(`${track.bitrateKbps} kbps`);
  return parts.join(" · ");
}

export function reasonLabel(reason: DuplicateReason): string {
  return reason === "same_isrc" ? "Same ISRC" : "Same artist, title and length";
}

const LOSSLESS = new Set(["flac", "wav", "aiff", "aif", "alac"]);

/**
 * The copy to suggest keeping: lossless first, then the higher bitrate, then
 * the first listed. Only a suggestion — the user picks.
 */
export function suggestedKeeper(tracks: MaintainTrack[]): string | null {
  if (tracks.length === 0) return null;
  const rank = (t: MaintainTrack) => [
    LOSSLESS.has((t.format ?? "").toLowerCase()) ? 1 : 0,
    t.bitrateKbps ?? 0,
  ];
  let best = tracks[0];
  for (const track of tracks.slice(1)) {
    const [al, ab] = rank(track);
    const [bl, bb] = rank(best);
    if (al > bl || (al === bl && ab > bb)) best = track;
  }
  return best.id;
}

/** The confirm line for "keep this one". */
export function keepConfirmLabel(removeCount: number): string {
  return removeCount === 1
    ? "Remove the other copy from the library? The file stays on disk, and Undo brings it back."
    : `Remove the other ${removeCount} copies from the library? The files stay on disk, and Undo brings them back.`;
}

export function duplicatesSummary(groups: number, copies: number, dismissed: number): string {
  if (groups === 0 && copies === 0) {
    return dismissed > 0
      ? `No duplicates found. ${dismissed} kept-both ${dismissed === 1 ? "group is" : "groups are"} hidden.`
      : "No duplicates found.";
  }
  const parts: string[] = [];
  if (groups > 0) parts.push(`${groups} ${groups === 1 ? "group" : "groups"} to review`);
  if (copies > 0) parts.push(`${copies} skipped file ${copies === 1 ? "copy" : "copies"}`);
  return parts.join(" · ");
}

const VERSION_LABELS: Record<VersionKind, string> = {
  original: "Original",
  radio: "Radio",
  extended: "Extended",
  club: "Club",
  instrumental: "Instrumental",
  acapella: "Acapella",
  dub: "Dub",
  vip: "VIP",
  remix: "Remix",
  edit: "Edit",
  live: "Live",
  other: "Other",
};

export function versionKindLabel(kind: VersionKind): string {
  return VERSION_LABELS[kind] ?? "Other";
}

/** What a version chip says: the marker as written, else the kind. */
export function versionChipLabel(kind: VersionKind, label?: string | null): string {
  const trimmed = label?.trim();
  return trimmed ? trimmed : versionKindLabel(kind);
}

export function versionsSummary(groups: number): string {
  if (groups === 0) return "No version families found.";
  return `${groups} ${groups === 1 ? "record has" : "records have"} more than one version in the library.`;
}

export type ScoreTone = "good" | "fair" | "poor" | "neutral";

/** Colour band for a 0–100 score. */
export function scoreTone(score: number | null): ScoreTone {
  if (score === null || !Number.isFinite(score)) return "neutral";
  if (score >= 85) return "good";
  if (score >= 60) return "fair";
  return "poor";
}

export function scoreText(score: number | null): string {
  return score === null || !Number.isFinite(score) ? "–" : String(Math.round(score));
}

/** The line under a category: its failing counts, or why it is neutral. */
export function categoryDetail(category: HealthCategoryView): string {
  if (!category.configured) return "Not set up yet — does not affect the score";
  const failing = category.counts.filter((c) => c.count > 0);
  if (failing.length === 0) return "All clear";
  return failing.map((c) => `${c.label}: ${c.count}`).join(" · ");
}

/** "Showing 500 of 812 tracks" when the drill-down list is capped. */
export function affectedNote(shown: number, total: number): string | null {
  if (total <= shown) return null;
  return `Showing ${shown} of ${total} tracks.`;
}

export function healthSummary(score: number | null, trackCount: number): string {
  if (trackCount === 0) return "No tracks yet. Import a folder to see the library's health.";
  if (score === null) return "Nothing measurable yet.";
  const rounded = Math.round(score);
  if (rounded >= 95) return "Your library looks healthy. Keep it that way.";
  return `Scored over ${trackCount} ${trackCount === 1 ? "track" : "tracks"}. Open a category to see what needs care.`;
}
