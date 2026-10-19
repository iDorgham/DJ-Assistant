export type AppView = "library" | "preparation" | "autoPerformance";
export type ThemeMode = "dark" | "light" | "system";
export type PlayerMode = "hidden" | "mini" | "full";

export interface UiState {
  view: AppView;
  navCollapsed: boolean;
  theme: ThemeMode;
  playerMode: PlayerMode;
  /** Restored when the player is toggled back from Hidden. */
  lastVisiblePlayerMode: PlayerMode;
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
  playerMode: "hidden",
  lastVisiblePlayerMode: "mini",
};

const VIEWS: readonly AppView[] = ["library", "preparation", "autoPerformance"];
const THEMES: readonly ThemeMode[] = ["dark", "light", "system"];
const PLAYER_MODES: readonly PlayerMode[] = ["hidden", "mini", "full"];

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
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
  const raw = store.getItem(UI_STATE_STORAGE_KEY);
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
      playerMode: oneOf(record.playerMode, PLAYER_MODES) ?? DEFAULT_UI_STATE.playerMode,
      lastVisiblePlayerMode:
        oneOf(record.lastVisiblePlayerMode, PLAYER_MODES) ?? DEFAULT_UI_STATE.lastVisiblePlayerMode,
    };
  } catch {
    return { ...DEFAULT_UI_STATE };
  }
}

export function persistUiState(state: UiState, storage?: StorageLike): void {
  const store = storage ?? defaultStorage();
  if (!store) return;
  store.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(state));
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
      return { type: "setView", view: "preparation" };
    case "3":
      return { type: "setView", view: "autoPerformance" };
    default:
      return null;
  }
}
