import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { X } from "lucide-react";

import type { UpdateTrackMetadataRequest } from "@dj-assistant/shared";

import { ModalShell } from "./ModalShell";
import {
  buildBulkDiff,
  buildBulkPatch,
  bulkSeedValues,
  surveyFields,
  validateBulkValues,
  type BulkDiffRow,
  type BulkField,
  type FieldSurvey,
} from "../lib/metadata-bulk";
import { normalizeTags, type MetadataEditorValues, type MetadataSource } from "../lib/tags";

/**
 * The metadata editor (T2.1.3 bulk edit; T2.1.7 / T2.1.13,
 * `docs/ui/03-LIBRARY-VIEW.md` §3.5).
 *
 * One dialog covers the fields the spec lists for "Edit tags…": title, artist,
 * album, genre, label, year, the custom tags and the free-text comment — and it
 * serves one track and a whole selection with the same code.
 *
 * What makes a selection safe is that the dialog never holds a value the user
 * did not choose. A field the tracks disagree on opens **empty** with a
 * `Mixed (N values)` placeholder, and only the fields the user actually edits
 * go into the write, so setting a comment on fifty tracks cannot quietly stamp
 * the first one's genre over the other forty-nine. The rules themselves live in
 * `lib/metadata-bulk`, where they are unit tested without a DOM.
 *
 * A multi-track write is previewed before it runs: the user sees the fields the
 * save carries and what each one replaces. The write, the "nothing changed"
 * check and the Undo snapshot still belong to the caller.
 */
interface MetadataEditorProps {
  /** The loaded rows the write applies to — one track, or the whole selection. */
  targets: MetadataSource[];
  /** The ids the write is sent for. Resolved by the caller from the selection. */
  trackIds: string[];
  /** Called with the ready-to-send patch; the caller performs the write. */
  onSave: (patch: UpdateTrackMetadataRequest) => void;
  /** Closes the dialog without saving. */
  onClose: () => void;
}

const FIELDS: Array<{
  key: Exclude<BulkField, "tags" | "comments">;
  label: string;
  placeholder: string;
}> = [
  { key: "title", label: "Title", placeholder: "Track title" },
  { key: "artist", label: "Artist", placeholder: "Artist name" },
  { key: "album", label: "Album", placeholder: "Album name" },
  { key: "genre", label: "Genre", placeholder: "Genre" },
  { key: "label", label: "Label", placeholder: "Record label" },
  { key: "year", label: "Year", placeholder: "YYYY" },
];

const INPUT_CLASS =
  "w-full rounded-md border border-dj-border bg-dj-elevated px-2.5 py-1.5 text-xs text-dj-text placeholder:text-dj-text-muted focus:border-dj-accent focus:outline-hidden";

/** What a field reads as when the selection does not agree on one value. */
function fieldHint(survey: FieldSurvey, bulk: boolean): string | undefined {
  if (!bulk) return undefined;
  if (survey.state === "mixed") return `Mixed (${survey.count} values)`;
  if (survey.state === "blank") return "Not set";
  return undefined;
}

export function MetadataEditor({ targets, trackIds, onSave, onClose }: MetadataEditorProps) {
  const bulk = targets.length > 1;
  const survey = useMemo(() => surveyFields(targets), [targets]);
  // The values the dialog opened with. The write is the difference between the
  // draft and this, so a field the user never touched is never sent.
  const [seed, setSeed] = useState<MetadataEditorValues>(() => bulkSeedValues(targets));
  const [values, setValues] = useState<MetadataEditorValues>(() => bulkSeedValues(targets));
  const [tagDraft, setTagDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BulkDiffRow[] | null>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // The draft is seeded from the selection, and reseeded only when a
  // **different** selection is opened. Keying on the ids rather than on the
  // array matters: a scan or an analysis job that finishes while the dialog is
  // open replaces the library rows, and an object-keyed seed would silently
  // throw the edits away.
  const seedKey = targets.map((entry) => entry.id ?? entry.title).join(",");
  const [seededKey, setSeededKey] = useState(seedKey);
  if (seededKey !== seedKey) {
    const next = bulkSeedValues(targets);
    setSeededKey(seedKey);
    setSeed(next);
    setValues(next);
    setTagDraft("");
    setError(null);
    setPreview(null);
  }

  const addTag = (raw: string) => {
    const [tag] = normalizeTags([raw]);
    if (!tag) return;
    setValues((current) => {
      if (current.tags.includes(tag)) return current;
      return { ...current, tags: [...current.tags, tag] };
    });
    setTagDraft("");
  };

  const removeTag = (tag: string) => {
    setValues((current) => ({ ...current, tags: current.tags.filter((entry) => entry !== tag) }));
  };

  const onTagKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      // Enter adds the tag; it must not submit the form behind it.
      event.preventDefault();
      addTag(tagDraft);
      return;
    }
    if (event.key === "Backspace" && tagDraft === "" && values.tags.length > 0) {
      // Backspace on an empty field removes the last tag — the convention
      // every chip input uses.
      event.preventDefault();
      setValues((current) => ({ ...current, tags: current.tags.slice(0, -1) }));
    }
  };

  const commit = () => {
    onSave(buildBulkPatch(trackIds, seed, { ...values, tags: normalizeTags(values.tags) }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validateBulkValues(seed, values);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    const rows = buildBulkDiff(seed, { ...values, tags: normalizeTags(values.tags) }, survey);
    // A selection is previewed before it is written; a save with nothing to
    // change has nothing to preview, and the caller's "nothing changed" rule
    // handles it.
    if (bulk && rows.length > 0) {
      setPreview(rows);
      return;
    }
    commit();
  };

  if (preview) {
    return (
      <ModalShell
        onClose={onClose}
        ariaLabel="Confirm metadata changes"
        panelClassName="w-[460px] max-w-full max-h-full overflow-y-auto bg-dj-panel border border-dj-border rounded-lg shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-dj-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-dj-text">Apply to {targets.length} tracks</p>
            <p className="text-[11px] text-dj-text-muted">
              Only these fields change. Everything else is left as each track has it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-dj-hover text-dj-text-secondary transition"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ul className="divide-y divide-dj-border px-4">
          {preview.map((row) => (
            <li key={row.field} className="flex items-baseline gap-3 py-2">
              <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted">
                {row.label}
              </span>
              <span className="min-w-0 flex-1 text-xs text-dj-text-secondary">
                <span className="break-words">{row.before}</span>
                <span className="mx-1.5 text-dj-text-muted">→</span>
                <span className="break-words text-dj-text">{row.after}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-center justify-end gap-2 border-t border-dj-border px-4 py-3">
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="rounded-md border border-dj-border bg-dj-elevated px-3 py-1.5 text-xs text-dj-text-secondary transition hover:bg-dj-hover"
          >
            Back
          </button>
          <button
            type="button"
            onClick={commit}
            className="rounded-md bg-dj-accent px-3 py-1.5 text-xs font-medium text-dj-on-accent shadow-sm shadow-dj-accent/25 transition hover:bg-dj-accent-strong"
          >
            Apply changes
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      onClose={onClose}
      ariaLabel="Edit track metadata"
      panelClassName="w-[520px] max-w-full max-h-full overflow-y-auto bg-dj-panel border border-dj-border rounded-lg shadow-2xl"
    >
      <form onSubmit={submit} className="flex flex-col">
        <div className="flex items-center justify-between border-b border-dj-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-dj-text">Edit metadata</p>
            <p className="text-[11px] text-dj-text-muted">
              {bulk
                ? `Applies to ${targets.length} selected tracks`
                : targets[0]?.title || "Untitled"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-dj-hover text-dj-text-secondary transition"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-3">
          {bulk && (
            <p className="rounded-sm border border-dj-border bg-dj-elevated px-2 py-1.5 text-[11px] text-dj-text-muted">
              A field the tracks disagree on opens empty. Fill it in to write that value to all{" "}
              {targets.length}; leave it empty to keep each track&apos;s own.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted">
                  {field.label}
                </span>
                <input
                  type="text"
                  inputMode={field.key === "year" ? "numeric" : undefined}
                  value={values[field.key]}
                  placeholder={fieldHint(survey[field.key], bulk) ?? field.placeholder}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                  className={INPUT_CLASS}
                />
              </label>
            ))}
          </div>

          <div>
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted">
              Custom tags
            </span>
            <div className="flex flex-wrap items-center gap-1 rounded-md border border-dj-border bg-dj-elevated px-2 py-1.5">
              {values.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-sm border border-dj-border bg-dj-panel px-1.5 py-0.5 text-[11px] text-dj-text-secondary"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="rounded-sm p-px text-dj-text-muted transition hover:text-dj-danger"
                    title={`Remove the tag ${tag}`}
                    aria-label={`Remove the tag ${tag}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
              <input
                ref={tagInputRef}
                type="text"
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={onTagKeyDown}
                onBlur={() => addTag(tagDraft)}
                placeholder={
                  values.tags.length > 0
                    ? "Add a tag"
                    : (fieldHint(survey.tags, bulk) ?? "peak, warmup…")
                }
                aria-label="Add a custom tag"
                className="min-w-[6rem] flex-1 bg-transparent text-[11px] text-dj-text placeholder:text-dj-text-muted focus:outline-hidden"
              />
            </div>
            <p className="mt-1 text-[11px] text-dj-text-muted">
              Enter adds a tag. Tags are folded to lower case, so “Peak” and “peak” are one tag.
            </p>
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted">
              Comment
            </span>
            <textarea
              rows={4}
              value={values.comments}
              placeholder={fieldHint(survey.comments, bulk) ?? "Your note about this track"}
              onChange={(event) =>
                setValues((current) => ({ ...current, comments: event.target.value }))
              }
              className={`${INPUT_CLASS} resize-y`}
            />
          </label>

          {error && (
            <p className="rounded-sm border border-dj-danger/30 bg-dj-danger/10 px-2 py-1.5 text-[11px] text-dj-danger">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-dj-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-dj-border bg-dj-elevated px-3 py-1.5 text-xs text-dj-text-secondary transition hover:bg-dj-hover"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md bg-dj-accent px-3 py-1.5 text-xs font-medium text-dj-on-accent shadow-sm shadow-dj-accent/25 transition hover:bg-dj-accent-strong"
            title={
              bulk
                ? "Review the changes before they are applied"
                : "Save the metadata (Undo is offered afterwards)"
            }
          >
            {bulk ? "Review changes" : "Save"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
