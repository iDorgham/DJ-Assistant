/**
 * Bulk metadata editing (T2.1.3, `docs/ui/03-LIBRARY-VIEW.md` §3.5).
 *
 * The rules the dialog needs when the write targets a selection rather than one
 * row, kept out of the component so they are testable without a DOM:
 *
 * * **A mixed field seeds empty, not from the focused track.** Whatever the
 *   dialog holds is what the write applies to every selected track, so a value
 *   carried over from one row would silently overwrite the others.
 * * **Only a field the user changed is written.** An untouched field is absent
 *   from the payload — not blank — so the backend leaves its column alone.
 *   Blank and unchanged are two different things, and the payload says which.
 * * **Validation follows the write.** A mixed title seeds blank; that is not an
 *   empty title, and it must not block a save that only edits the comment.
 */
import type { UpdateTrackMetadataRequest } from "@dj-assistant/shared";

import { normalizeTags, type MetadataEditorValues, type MetadataSource } from "./tags.ts";

/** The fields the editor owns, in dialog order. */
export const BULK_FIELDS = [
  "title",
  "artist",
  "album",
  "genre",
  "label",
  "year",
  "tags",
  "comments",
] as const;

export type BulkField = (typeof BULK_FIELDS)[number];

/** The label the diff and the inputs show for a field. */
export const FIELD_LABELS: Record<BulkField, string> = {
  title: "Title",
  artist: "Artist",
  album: "Album",
  genre: "Genre",
  label: "Label",
  year: "Year",
  tags: "Tags",
  comments: "Comment",
};

/** The text a diff shows for a field the write empties. */
const CLEARED = "Cleared";

/** The text a survey shows for a field no track carries. */
const NOTHING = "—";

/** What one field looks like across a whole selection. */
export type FieldSurvey =
  /** Every track holds the same value. */
  | { state: "single"; value: string }
  /** Every track leaves it empty — the same thing, but not a value to show. */
  | { state: "blank" }
  /** The tracks disagree; `count` is how many different readings there are. */
  | { state: "mixed"; count: number };

/** The field's value on one track, in the shape the selection is compared in. */
function fieldValue(track: MetadataSource, field: BulkField): string {
  switch (field) {
    case "year":
      return track.year != null ? String(track.year) : "";
    case "tags":
      // The set is normalised before it is compared, so a different chip order
      // is not a different set.
      return normalizeTags(track.tags).join(", ");
    case "title":
      return (track.title ?? "").trim();
    case "artist":
      return (track.artist ?? "").trim();
    case "comments":
      return (track.comments ?? "").trim();
    default:
      return (track[field] ?? "").trim();
  }
}

/** How each editable field reads across `tracks`. */
export function surveyFields(tracks: MetadataSource[]): Record<BulkField, FieldSurvey> {
  const survey = {} as Record<BulkField, FieldSurvey>;
  for (const field of BULK_FIELDS) {
    const distinct = new Set(tracks.map((track) => fieldValue(track, field)));
    const [only] = [...distinct];
    if (distinct.size === 0 || (distinct.size === 1 && only === "")) {
      survey[field] = { state: "blank" };
    } else if (distinct.size === 1) {
      survey[field] = { state: "single", value: only };
    } else {
      survey[field] = { state: "mixed", count: distinct.size };
    }
  }
  return survey;
}

/**
 * The values the dialog opens with: an agreed value, or empty for anything the
 * selection disagrees on.
 */
export function bulkSeedValues(tracks: MetadataSource[]): MetadataEditorValues {
  const survey = surveyFields(tracks);
  const seed = (field: BulkField): string =>
    survey[field].state === "single" ? survey[field].value : "";
  const tags = survey.tags;
  return {
    title: seed("title"),
    artist: seed("artist"),
    album: seed("album"),
    genre: seed("genre"),
    label: seed("label"),
    year: seed("year"),
    comments: seed("comments"),
    tags: tags.state === "single" && tags.value ? tags.value.split(", ") : [],
  };
}

/** The field's current text in the dialog, in the form the write compares. */
function draftValue(values: MetadataEditorValues, field: BulkField): string {
  return field === "tags" ? normalizeTags(values.tags).join(", ") : values[field].trim();
}

/** The fields whose draft differs from what the dialog was seeded with. */
export function changedBulkFields(
  from: MetadataEditorValues,
  to: MetadataEditorValues
): BulkField[] {
  return BULK_FIELDS.filter((field) => draftValue(from, field) !== draftValue(to, field));
}

/**
 * The write payload for a bulk edit: the track ids and only the fields that
 * changed. An absent field is the backend's cue to leave its column alone.
 */
export function buildBulkPatch(
  trackIds: string[],
  from: MetadataEditorValues,
  to: MetadataEditorValues
): UpdateTrackMetadataRequest {
  const patch: UpdateTrackMetadataRequest = { trackIds };
  for (const field of changedBulkFields(from, to)) {
    if (field === "year") {
      // `0` is the backend's "clear the year" value.
      const year = to.year.trim();
      patch.year = year ? Number(year) : 0;
    } else if (field === "tags") {
      // The tag list is a set: the payload replaces it whole.
      patch.tags = normalizeTags(to.tags);
    } else {
      patch[field] = to[field].trim();
    }
  }
  return patch;
}

/**
 * The first problem with the draft, or `null` when it can be written.
 *
 * Only the fields the write actually carries are checked: a mixed column seeds
 * blank, and a blank the user never touched is not an empty value being saved.
 */
export function validateBulkValues(
  from: MetadataEditorValues,
  to: MetadataEditorValues
): string | null {
  const changed = new Set(changedBulkFields(from, to));
  if (changed.has("title") && !to.title.trim()) return "Title cannot be empty.";
  if (changed.has("artist") && !to.artist.trim()) return "Artist cannot be empty.";
  if (changed.has("year")) {
    const year = to.year.trim();
    if (year && !/^\d{4}$/.test(year)) return "Year must be four digits.";
    if (year && Number(year) < 1000) return "Year must be between 1000 and 9999.";
  }
  return null;
}

/** One line of the preview: what the write replaces, and with what. */
export interface BulkDiffRow {
  field: BulkField;
  label: string;
  before: string;
  after: string;
}

/** What the selection holds for a field, as the preview reads it. */
function surveyText(survey: FieldSurvey): string {
  if (survey.state === "mixed") return `Mixed (${survey.count} values)`;
  if (survey.state === "single") return survey.value;
  return NOTHING;
}

/**
 * The preview shown before a bulk write runs: one row per field the write
 * carries. An empty list means the save would change nothing.
 */
export function buildBulkDiff(
  from: MetadataEditorValues,
  to: MetadataEditorValues,
  survey: Record<BulkField, FieldSurvey>
): BulkDiffRow[] {
  return changedBulkFields(from, to).map((field) => ({
    field,
    label: FIELD_LABELS[field],
    before: surveyText(survey[field]),
    after: draftValue(to, field) || CLEARED,
  }));
}
