export type PrimaryView =
  "library" | "playlists" | "discover" | "statistics" | "publish" | "settings";

/**
 * Surfaces that are reachable from the shell but are not primary tabs:
 * Import Center, Inbox, the player workspace, backup and DJ-app sync.
 */
export type UtilityView = "import" | "analysis" | "studio" | "backup" | "sync" | "inbox";

export type AppView = PrimaryView | UtilityView;

export const PRIMARY_VIEWS: readonly PrimaryView[] = [
  "library",
  "playlists",
  "discover",
  "statistics",
  "publish",
  "settings",
];

export const UTILITY_VIEWS: readonly UtilityView[] = [
  "import",
  "analysis",
  "studio",
  "backup",
  "sync",
  "inbox",
];

export const ALL_VIEWS: readonly AppView[] = [...PRIMARY_VIEWS, ...UTILITY_VIEWS];

export const VIEW_LABELS: Record<AppView, string> = {
  library: "Library",
  playlists: "Playlists",
  discover: "Discover",
  statistics: "Statistics",
  publish: "Publish",
  settings: "Settings",
  import: "Import Center",
  analysis: "Analysis",
  studio: "Studio",
  backup: "Backup",
  sync: "DJ app sync",
  inbox: "Inbox",
};

export type ThemeMode = "dark" | "light" | "system";
/**
 * The dock has two visible sizes. Full carries the hot-cue / grid-tools panel
 * switch, so there is no separate "extended" presentation any more.
 */
export type PlayerMode = "hidden" | "mini" | "full";
export type VisiblePlayerMode = Exclude<PlayerMode, "hidden">;

/**
 * Dock geometry. Mini is compact (96–139); Full starts at 230 so the cover,
 * track line, overview and transport still fit. No presentation is designed
 * for the 140–229 gap, so the splitter resolves it to the nearer edge.
 */
export const MIN_MINI_HEIGHT = 96;
export const MAX_MINI_HEIGHT = 139;
export const DEFAULT_MINI_HEIGHT = 104;
export const MIN_FULL_HEIGHT = 230;
export const DEFAULT_FULL_HEIGHT = 246;
export const MAX_PLAYER_HEIGHT = 440;

export function resolvePlayerHeight(rawHeight: number): number {
  const clamped = Math.max(MIN_MINI_HEIGHT, Math.min(rawHeight, MAX_PLAYER_HEIGHT));
  if (clamped <= MAX_MINI_HEIGHT || clamped >= MIN_FULL_HEIGHT) return clamped;
  const midpoint = (MAX_MINI_HEIGHT + MIN_FULL_HEIGHT) / 2;
  return clamped < midpoint ? MAX_MINI_HEIGHT : MIN_FULL_HEIGHT;
}

export interface UiState {
  view: AppView;
  navCollapsed: boolean;
  theme: ThemeMode;
  playerMode: PlayerMode;
  /** Restored when the player is toggled back from Hidden. */
  lastVisiblePlayerMode: VisiblePlayerMode;
}

export type UiAction =
  | { type: "setView"; view: AppView }
  | { type: "toggleNav" }
  | { type: "setTheme"; theme: ThemeMode }
  | { type: "setPlayerMode"; mode: PlayerMode }
  | { type: "togglePlayer" };

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const UI_STATE_STORAGE_KEY = "dj-assistant.ui-state.v1";

export const DEFAULT_UI_STATE: UiState = {
  view: "library",
  navCollapsed: false,
  theme: "dark",
  playerMode: "mini",
  lastVisiblePlayerMode: "mini",
};

const VIEWS: readonly AppView[] = ALL_VIEWS;
const THEMES: readonly ThemeMode[] = ["dark", "light", "system"];
const PLAYER_MODES: readonly PlayerMode[] = ["hidden", "mini", "full"];
const VISIBLE_PLAYER_MODES: readonly VisiblePlayerMode[] = ["mini", "full"];

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/**
 * Persisted sessions from earlier builds may still say "extended". The tall
 * presentation was removed, so migrate it to Full instead of resetting the
 * user's dock to Mini.
 */
function persistedPlayerMode(value: unknown): PlayerMode | null {
  if (value === "extended") return "full";
  return oneOf(value, PLAYER_MODES);
}

function persistedVisiblePlayerMode(value: unknown): VisiblePlayerMode | null {
  if (value === "extended") return "full";
  return oneOf(value, VISIBLE_PLAYER_MODES);
}

export function reduceUiState(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case "setView": {
      const view = oneOf(action.view, VIEWS);
      return view ? { ...state, view } : state;
    }
    case "toggleNav":
      return { ...state, navCollapsed: !state.navCollapsed };
    case "setTheme": {
      const theme = oneOf(action.theme, THEMES);
      return theme ? { ...state, theme } : state;
    }
    case "setPlayerMode": {
      const mode = oneOf(action.mode, PLAYER_MODES);
      if (!mode) return state;
      return mode === "hidden"
        ? { ...state, playerMode: "hidden" }
        : { ...state, playerMode: mode, lastVisiblePlayerMode: mode };
    }
    case "togglePlayer":
      return {
        ...state,
        playerMode: state.playerMode === "hidden" ? state.lastVisiblePlayerMode : "hidden",
      };
    default:
      return state;
  }
}

function defaultStorage(): StorageLike | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function initUiState(storage?: StorageLike): UiState {
  const store = storage ?? defaultStorage();
  if (!store) return { ...DEFAULT_UI_STATE };
  let raw: string | null;
  try {
    raw = store.getItem(UI_STATE_STORAGE_KEY);
  } catch {
    return { ...DEFAULT_UI_STATE };
  }
  if (!raw) return { ...DEFAULT_UI_STATE };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return { ...DEFAULT_UI_STATE };
    const record = parsed as Record<string, unknown>;
    return {
      view: oneOf(record.view, VIEWS) ?? DEFAULT_UI_STATE.view,
      navCollapsed:
        typeof record.navCollapsed === "boolean"
          ? record.navCollapsed
          : DEFAULT_UI_STATE.navCollapsed,
      theme: oneOf(record.theme, THEMES) ?? DEFAULT_UI_STATE.theme,
      playerMode: persistedPlayerMode(record.playerMode) ?? DEFAULT_UI_STATE.playerMode,
      lastVisiblePlayerMode:
        persistedVisiblePlayerMode(record.lastVisiblePlayerMode) ??
        DEFAULT_UI_STATE.lastVisiblePlayerMode,
    };
  } catch {
    return { ...DEFAULT_UI_STATE };
  }
}

export function persistUiState(state: UiState, storage?: StorageLike): void {
  const store = storage ?? defaultStorage();
  if (!store) return;
  try {
    store.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Persistence is best-effort; blocked or full storage must not break the UI.
  }
}

export interface ShortcutEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
}

export function shortcutToAction(event: ShortcutEvent): UiAction | null {
  if (!event.ctrlKey && !event.metaKey) return null;
  switch (event.key) {
    case "1":
      return { type: "setView", view: "library" };
    case "2":
      return { type: "setView", view: "playlists" };
    case "3":
      return { type: "setView", view: "discover" };
    case "4":
      return { type: "setView", view: "statistics" };
    case "5":
      return { type: "setView", view: "publish" };
    case "6":
      return { type: "setView", view: "settings" };
    case "i":
      return { type: "setView", view: "import" };
    case ",":
      return { type: "setView", view: "settings" };
    default:
      return null;
  }
}
