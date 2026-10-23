import { useEffect, useRef, useState } from "react";
import type { TrackDetail } from "@dj-assistant/shared";
import { Check, Copy } from "lucide-react";

import { fileFormatLabel, formatFileSize, formatSampleRate } from "../../lib/track-panel";

export function FileTab({ track }: { track: TrackDetail }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(track.filePath);
      setCopyError(false);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy the file path:", err);
      setCopyError(true);
    }
  };

  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted">
          Path
        </h3>
        <p className="break-all rounded-md border border-dj-border bg-dj-elevated p-2 font-mono text-[11px] text-dj-text-secondary">
          {track.filePath}
        </p>
        <button
          type="button"
          onClick={copyPath}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-dj-border bg-dj-elevated px-2.5 py-1.5 text-[11px] text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
        >
          {copied ? <Check className="h-3 w-3 text-dj-success" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy path"}
        </button>
        {copyError && (
          <p className="mt-1.5 text-[11px] text-dj-danger">Couldn&apos;t copy the path.</p>
        )}
      </section>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
        <Fact label="Format" value={fileFormatLabel(track.format)} mono />
        <Fact label="Size" value={formatFileSize(track.fileSize)} mono />
        <Fact label="Sample rate" value={formatSampleRate(track.sampleRate)} mono />
        <Fact
          label="Bit depth"
          value={track.bitDepth != null ? `${track.bitDepth} bit` : null}
          mono
        />
        <Fact
          label="Channels"
          value={track.channels != null ? `${track.channels} ch` : null}
          mono
        />
        <Fact label="Hash" value={track.fileHash} mono />
        <Fact label="Added" value={formatTimestamp(track.createdAt)} />
        <Fact label="Updated" value={formatTimestamp(track.updatedAt)} />
      </dl>
    </div>
  );
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function Fact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  const shown = value?.trim() || "—";
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-dj-text-muted">
        {label}
      </dt>
      <dd className={`break-all text-dj-text-secondary ${mono ? "font-mono" : ""}`} title={shown}>
        {shown}
      </dd>
    </div>
  );
}
