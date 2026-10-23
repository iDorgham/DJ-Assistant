import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  Disc3,
  FolderOpen,
  Info,
  PanelLeft,
  Play,
  RefreshCw,
  ShieldCheck,
  Sun,
} from "lucide-react";

import { THEME_LABELS, nextTheme } from "../lib/theme";
import type { ThemeMode } from "../lib/ui-state";

interface SettingsViewProps {
  theme: ThemeMode;
  navCollapsed: boolean;
  playerVisible: boolean;
  onCycleTheme: () => void;
  onToggleNav: () => void;
  onTogglePlayer: () => void;
  onOpenImport: () => void;
  onOpenAnalysis: () => void;
  onOpenBackup: () => void;
  onOpenSync: () => void;
  onOpenStudio: () => void;
}

function SettingRow({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-dj-border bg-dj-elevated">
        <Icon className="h-4 w-4 text-dj-text-secondary" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-dj-text">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-dj-text-secondary">{description}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="mt-0.5 inline-flex shrink-0 items-center gap-1 border border-dj-border bg-dj-panel px-2 py-1 text-[11px] font-medium text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-dj-accent"
      >
        {actionLabel}
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}

export function SettingsView({
  theme,
  navCollapsed,
  playerVisible,
  onCycleTheme,
  onToggleNav,
  onTogglePlayer,
  onOpenImport,
  onOpenAnalysis,
  onOpenBackup,
  onOpenSync,
  onOpenStudio,
}: SettingsViewProps) {
  const nextThemeLabel = THEME_LABELS[nextTheme(theme)];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="shrink-0 border-b border-dj-border bg-dj-panel px-6 py-4">
        <h1 className="text-sm font-semibold text-dj-text">Settings</h1>
        <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-dj-text-secondary">
          The Stage 1 shell. Appearance, import, DJ-app sync and backup destinations are grouped
          here; the deeper editors arrive with their stages.
        </p>
      </div>

      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <section aria-labelledby="settings-appearance">
          <h2
            id="settings-appearance"
            className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted"
          >
            Appearance
          </h2>
          <div className="divide-y divide-dj-border border border-dj-border bg-dj-panel">
            <SettingRow
              icon={Sun}
              title="Theme"
              description={`${THEME_LABELS[theme]} is active. Themes use the shared Carbon token set; no second palette is introduced.`}
              actionLabel={`Use ${nextThemeLabel}`}
              onAction={onCycleTheme}
            />
            <SettingRow
              icon={PanelLeft}
              title="Navigation"
              description={
                navCollapsed
                  ? "The icon rail is collapsed to keep the workspace wide."
                  : "The navigation is expanded and shows labels."
              }
              actionLabel={navCollapsed ? "Expand" : "Collapse"}
              onAction={onToggleNav}
            />
            <SettingRow
              icon={Disc3}
              title="Player dock"
              description={
                playerVisible
                  ? "The shared player dock is visible across the six tabs."
                  : "The player dock is hidden. Opening it restores the last visible presentation."
              }
              actionLabel={playerVisible ? "Hide" : "Show"}
              onAction={onTogglePlayer}
            />
          </div>
        </section>

        <section aria-labelledby="settings-library">
          <h2
            id="settings-library"
            className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted"
          >
            Library and import
          </h2>
          <div className="divide-y divide-dj-border border border-dj-border bg-dj-panel">
            <SettingRow
              icon={FolderOpen}
              title="Import Center"
              description="Folder scan, drag and drop, watch folders, duplicate detection and import history. Import is a top-bar action, not a permanent tab."
              actionLabel="Open"
              onAction={onOpenImport}
            />
            <SettingRow
              icon={Activity}
              title="Analysis queue"
              description="Pending, running and failed analysis jobs. The local-first analysis engine is wired in the existing backend."
              actionLabel="Open"
              onAction={onOpenAnalysis}
            />
            <SettingRow
              icon={Play}
              title="Player workspace"
              description="The Studio surface is a planned workspace; the shared player dock is available from every tab now."
              actionLabel="Open"
              onAction={onOpenStudio}
            />
          </div>
        </section>

        <section aria-labelledby="settings-apps">
          <h2
            id="settings-apps"
            className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted"
          >
            DJ applications
          </h2>
          <div className="divide-y divide-dj-border border border-dj-border bg-dj-panel">
            <SettingRow
              icon={RefreshCw}
              title="Sync"
              description="rekordbox is first, Traktor second. Pull, review, maintain, push; the Library wins editorial metadata and the DJ app wins cues and beat grids."
              actionLabel="Open"
              onAction={onOpenSync}
            />
          </div>
        </section>

        <section aria-labelledby="settings-backup">
          <h2
            id="settings-backup"
            className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted"
          >
            Backup
          </h2>
          <div className="divide-y divide-dj-border border border-dj-border bg-dj-panel">
            <SettingRow
              icon={ShieldCheck}
              title="Backup destination"
              description="No backup destination is configured yet. Backup and restore arrive in Stage 10; the current library was backed up before Stage 1 began."
              actionLabel="Open"
              onAction={onOpenBackup}
            />
          </div>
        </section>

        <section aria-labelledby="settings-about">
          <h2
            id="settings-about"
            className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted"
          >
            About
          </h2>
          <div className="border border-dj-border bg-dj-panel p-4">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-dj-text-muted" aria-hidden="true" />
              <div className="space-y-1.5 text-[11px] leading-relaxed text-dj-text-secondary">
                <p>
                  DJ Assistant <span className="font-mono text-dj-text">0.1.0</span> · Stage 1
                  foundation and shell.
                </p>
                <p>
                  The approved v1 plan is mirrored at{" "}
                  <code className="font-mono text-dj-text">docs/plan/README.md</code> with decisions
                  D-001–D-052. Playlists, Discover, Statistics and Publish open with honest
                  placeholders until their stages land.
                </p>
                <p>
                  Renderer errors are caught by the app boundary. Diagnostics redact credentials,
                  email addresses and user-home paths before they reach the console.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
