import type {
  ScanFolderRequest,
  ScanFolderResponse,
  ListTracksRequest,
  ListTracksResponse,
  GetTrackRequest,
  GetTrackResponse,
  GetArtworkRequest,
  GetArtworkResponse,
  ScanProgressEvent,
  ScanCompletedEvent,
} from "@dj-assistant/shared";

// Safe Tauri invocation wrapper with mock fallback for web development
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function scanFolder(req: ScanFolderRequest): Promise<ScanFolderResponse> {
  if (!isTauri) {
    console.warn("[Mock API] Tauri not detected, running mock scan");
    return { jobId: "mock-job-" + Date.now(), estimatedFiles: 42 };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ScanFolderResponse>("scan_folder", { request: req });
}

export async function listTracks(req: ListTracksRequest = {}): Promise<ListTracksResponse> {
  if (!isTauri) {
    console.warn("[Mock API] Tauri not detected, returning empty or stored tracks");
    return { tracks: [], total: 0 };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ListTracksResponse>("list_tracks", { request: req });
}

export async function getTrack(req: GetTrackRequest): Promise<GetTrackResponse> {
  if (!isTauri) {
    throw new Error("Tauri not detected in mock mode");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<GetTrackResponse>("get_track", { request: req });
}

/**
 * Loads cached cover art as a `data:` URL. Returns `null` when the track has no
 * artwork — the caller renders a placeholder in that case.
 */
export async function getArtwork(req: GetArtworkRequest): Promise<GetArtworkResponse> {
  if (!isTauri) {
    return null;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<GetArtworkResponse>("get_artwork", { request: req });
}

export async function openFolderDialog(): Promise<string | null> {
  if (!isTauri) {
    const mockPath = window.prompt("Enter folder path for mock scan:", "D:/Music/TestSet");
    return mockPath || null;
  }
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Music Library Folder",
    });
    if (Array.isArray(selected)) {
      return selected[0] ?? null;
    }
    return selected;
  } catch (err) {
    console.error("Failed to open native folder dialog:", err);
    return null;
  }
}

export async function listenToScanProgress(
  callback: (event: ScanProgressEvent) => void
): Promise<() => void> {
  if (!isTauri) {
    return () => {};
  }
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<ScanProgressEvent>("scan:progress", (e) => {
    callback(e.payload);
  });
  return unlisten;
}

export async function listenToScanCompleted(
  callback: (event: ScanCompletedEvent) => void
): Promise<() => void> {
  if (!isTauri) {
    return () => {};
  }
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<ScanCompletedEvent>("scan:completed", (e) => {
    callback(e.payload);
  });
  return unlisten;
}
