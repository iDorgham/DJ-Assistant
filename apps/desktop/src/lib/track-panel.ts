/**
 * Pure helpers for the shared Track panel (Stage 2).
 *
 * Kept free of React and Tauri so the tab rules and the file/cue formatting can
 * be unit tested with `node --test`. The tab list is the locked model from
 * `docs/plan/02-experience/track-panel-and-player.md` §2.
 */

import type { CuePoint } from "@dj-assistant/shared";

import type { StorageLike } from "./ui-state.ts";

export const TRACK_PANEL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "tags", label: "Tags" },
  { id: "cues", label: "Cues" },
  { id: "analysis", label: "Analysis" },
  { id: "playlists", label: "Playlists" },
  { id: "history", label: "History" },
  { id: "file", label: "File" },
] as const;

export type TrackPanelTab = (typeof TRACK_PANEL_TABS)[number]["id"];

export const DEFAULT_TRACK_PANEL_TAB: TrackPanelTab = "overview";

/** The panel remembers one tab per user, not one per track. */
export const TRACK_PANEL_TAB_STORAGE_KEY = "dj-assistant.track-panel.v1";

export function isTrackPanelTab(value: unknown): value is TrackPanelTab {
  return TRACK_PANEL_TABS.some((tab) => tab.id === value);
}

function defaultStorage(): StorageLike | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function readTrackPanelTab(storage?: StorageLike): TrackPanelTab {
  const store = storage ?? defaultStorage();
  if (!store) return DEFAULT_TRACK_PANEL_TAB;
  try {
    const raw = store.getItem(TRACK_PANEL_TAB_STORAGE_KEY);
    return isTrackPanelTab(raw) ? raw : DEFAULT_TRACK_PANEL_TAB;
  } catch {
    return DEFAULT_TRACK_PANEL_TAB;
  }
}

export function persistTrackPanelTab(tab: TrackPanelTab, storage?: StorageLike): void {
  const store = storage ?? defaultStorage();
  if (!store) return;
  try {
    store.setItem(TRACK_PANEL_TAB_STORAGE_KEY, tab);
  } catch {
    // Persistence is best-effort; blocked storage must not break the panel.
  }
}

export type PanelTabKey = "ArrowLeft" | "ArrowRight" | "Home" | "End";

/** WAI-ARIA tabs keyboard model: arrows wrap, Home/End jump to the ends. */
export function movePanelTab(current: TrackPanelTab, key: PanelTabKey): TrackPanelTab {
  if (key === "Home") return TRACK_PANEL_TABS[0].id;
  if (key === "End") return TRACK_PANEL_TABS[TRACK_PANEL_TABS.length - 1].id;
  const index = TRACK_PANEL_TABS.findIndex((tab) => tab.id === current);
  const step = key === "ArrowRight" ? 1 : -1;
  const next = (index + step + TRACK_PANEL_TABS.length) % TRACK_PANEL_TABS.length;
  return TRACK_PANEL_TABS[next].id;
}

const FILE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** Byte counts scale by 1024; a decimal below the byte unit is noise. */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < FILE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const shown = unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${shown} ${FILE_UNITS[unit]}`;
}

/** Sample rates are stored in Hz and read best in kHz. */
export function formatSampleRate(hz: number | null | undefined): string {
  if (hz == null || !Number.isFinite(hz) || hz <= 0) return "—";
  const khz = hz / 1000;
  return `${Number.isInteger(khz) ? khz : khz.toFixed(1)} kHz`;
}

const CUE_TYPE_LABELS: Record<CuePoint["cueType"], string> = {
  hot_cue: "Hot cue",
  memory_cue: "Memory cue",
  loop: "Loop",
};

export function formatCueType(type: CuePoint["cueType"]): string {
  return CUE_TYPE_LABELS[type] ?? type;
}

/** Cue positions need millisecond precision, unlike track durations. */
export function formatCueTime(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor(ms % 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

/** A cue's display name: its label if it has one, otherwise its slot. */
export function cueTitle(cue: CuePoint): string {
  const label = cue.label?.trim();
  if (label) return label;
  const type = formatCueType(cue.cueType);
  return cue.slot != null ? `${type} ${cue.slot}` : type;
}

export function fileFormatLabel(format: string | null | undefined): string {
  const value = format?.trim();
  return value ? value.toUpperCase() : "—";
}
