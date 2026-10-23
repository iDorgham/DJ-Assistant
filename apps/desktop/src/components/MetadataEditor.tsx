import { useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { X } from "lucide-react";

import { ModalShell } from "./ModalShell";
import {
  metadataEditorValues,
  normalizeTags,
  validateMetadataValues,
  type MetadataEditorValues,
  type MetadataSource,
} from "../lib/tags";

/**
 * The metadata editor (T2.1.7 / T2.1.13, `docs/ui/03-LIBRARY-VIEW.md` §3.5).
 *
 * One dialog covers the fields the spec lists for "Edit tags…": title, artist,
 * album, genre, label, year, the custom tags and the free-text comment.
 *
 * The dialog is deliberately dumb: it edits a local draft and hands the
 * values to `onSave`. The write, the "nothing changed" check and the Undo
 * snapshot all belong to the caller, so the same dialog serves one track and a
 * multi-track selection.
 *
 * A multi-selection shows the *focused* track's values and applies them to
 * every selected track — the same semantics the rating and energy writes use.
 */
interface MetadataEditorProps {
  /** The track the editor was opened on; seeds the draft. */
  track: MetadataSource;
  /** How many tracks the save applies to — shown in the header. */
  targetCount: number;
  /** Called with the edited values; the caller performs the write. */
  onSave: (values: MetadataEditorValues) => void;
  /** Closes the dialog without saving. */
  onClose: () => void;
}

const FIELDS: Array<{
  key: "title" | "artist" | "album" | "genre" | "label" | "year";
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

export function MetadataEditor({ track, targetCount, onSave, onClose }: MetadataEditorProps) {
  const [values, setValues] = useState<MetadataEditorValues>(() => metadataEditorValues(track));
  const [tagDraft, setTagDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // The draft is seeded from the track, and reseeded only when a **different**
  // track is opened. Keying on the track's identity rather than on the object
  // matters: a scan or an analysis job that finishes while the dialog is open
  // replaces the library rows, and an object-keyed seed would silently throw
  // the edits away.
  const seedKey = track.id ?? track.title;
  const [seededKey, setSeededKey] = useState(seedKey);
  if (seededKey !== seedKey) {
    setSeededKey(seedKey);
    setValues(metadataEditorValues(track));
    setTagDraft("");
    setError(null);
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

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validateMetadataValues(values);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    onSave({ ...values, tags: normalizeTags(values.tags) });
  };

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
              {targetCount === 1
                ? track.title || "Untitled"
                : `Applies to ${targetCount} selected tracks`}
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
                  placeholder={field.placeholder}
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
                placeholder={values.tags.length === 0 ? "peak, warmup…" : "Add a tag"}
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
              placeholder="Your note about this track"
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
            title="Save the metadata (Undo is offered afterwards)"
          >
            Save
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
