import { initUiState, type StorageLike, type ThemeMode } from "./ui-state.ts";

export type ResolvedTheme = "dark" | "light";

export const THEME_LABELS: Record<ThemeMode, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
};

export function resolveTheme(theme: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (theme === "system") return systemPrefersDark ? "dark" : "light";
  return theme;
}

export function nextTheme(theme: ThemeMode): ThemeMode {
  if (theme === "dark") return "light";
  if (theme === "light") return "system";
  return "dark";
}

export function resolveStoredTheme(
  storage?: StorageLike,
  systemPrefersDark?: boolean
): ResolvedTheme {
  const prefersDark =
    systemPrefersDark ??
    (typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : true);
  return resolveTheme(initUiState(storage).theme, prefersDark);
}
