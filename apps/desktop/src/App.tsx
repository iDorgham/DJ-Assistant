import { useEffect, useState, useMemo } from "react";
import type { TrackSummary, ScanProgressEvent, ScanCompletedEvent } from "@dj-assistant/shared";
import {
  openFolderDialog,
  scanFolder,
  listTracks,
  getArtwork,
  listenToScanProgress,
  listenToScanCompleted,
} from "./services/api";
import {
  FolderOpen,
  Music,
  Clock,
  Search,
  RefreshCw,
  HardDrive,
  ShieldCheck,
  Disc3,
  CheckCircle2,
} from "lucide-react";
import {
  filterTracks,
  formatBpm,
  formatDuration,
  formatKey,
  formatRating,
  scanPercent,
  shortHash,
  truncateComment,
} from "./lib/library";

/**
 * Lazily loads one track's cached cover art and falls back to a placeholder
 * icon while loading, for missing art, or when the cache read fails.
 */
function ArtworkThumb({ trackId, hasArtwork }: { trackId: string; hasArtwork: boolean }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!hasArtwork) {
      setSrc(null);
      return;
    }
    getArtwork({ trackId })
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch((err) => {
        console.error("Failed to load artwork:", err);
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [trackId, hasArtwork]);

  if (!src) {
    return (
      <div
        className="h-9 w-9 rounded-sm bg-[#1a1e2b] border border-[#2a2f42] flex items-center justify-center"
        title={hasArtwork ? "Loading artwork..." : "No embedded artwork"}
      >
        <Music className="w-4 h-4 text-slate-600" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className="h-9 w-9 rounded-sm object-cover border border-[#2a2f42]"
    />
  );
}

export default function App() {
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgressEvent | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("Ready");

  // Load tracks
  const refreshLibrary = async () => {
    setLoading(true);
    try {
      const res = await listTracks({ query: searchQuery });
      setTracks(res.tracks);
      setStatusMessage(`Library loaded: ${res.total} tracks`);
    } catch (err) {
      console.error("Failed to load library tracks:", err);
      setStatusMessage("Error loading tracks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshLibrary();
    // Mount-only by design: the loader closes over the initial query, and the
    // search box filters client-side, so refetching on every query change
    // would add IPC churn for no gain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen to Tauri scan events
  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;
    let unlistenCompleted: (() => void) | undefined;

    listenToScanProgress((payload) => {
      setProgress(payload);
      if (payload.importedTrack) {
        setTracks((prev) => {
          if (prev.some((t) => t.id === payload.importedTrack!.id)) return prev;
          return [payload.importedTrack!, ...prev];
        });
      }
    }).then((fn) => {
      unlistenProgress = fn;
    });

    listenToScanCompleted((summary: ScanCompletedEvent) => {
      setScanning(false);
      setProgress(null);
      setStatusMessage(
        `Scan complete! Imported: ${summary.totalImported}, Duplicates: ${summary.totalDuplicates}, Errors: ${summary.totalErrors}`
      );
      refreshLibrary();
    }).then((fn) => {
      unlistenCompleted = fn;
    });

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenCompleted) unlistenCompleted();
    };
    // Listeners are registered once; the completion handler calls the loader
    // captured at mount, which is enough to reload the library after a scan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectFolder = async () => {
    const selected = await openFolderDialog();
    if (!selected) return;

    setCurrentFolder(selected);
    setScanning(true);
    setStatusMessage(`Scanning folder: ${selected}...`);

    try {
      await scanFolder({ path: selected, recursive: true });
    } catch (err) {
      console.error("Error starting scan:", err);
      setScanning(false);
      setStatusMessage(`Scan failed: ${err}`);
    }
  };

  const filteredTracks = useMemo(() => filterTracks(tracks, searchQuery), [tracks, searchQuery]);

  return (
    <div className="flex flex-col h-screen bg-[#0f1117] text-slate-100 font-sans">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-[#2a2f42] bg-[#141721] px-5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-lg bg-linear-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Disc3 className="w-5 h-5 text-white animate-spin-slow" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-base text-white">DJ Assistant</span>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-sm bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Phase 0 Foundation
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSelectFolder}
            disabled={scanning}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-medium px-3.5 py-1.5 rounded-md transition shadow-sm shadow-blue-600/30"
          >
            <FolderOpen className="w-4 h-4" />
            <span>{scanning ? "Scanning..." : "Scan Music Folder"}</span>
          </button>

          <button
            onClick={refreshLibrary}
            disabled={loading || scanning}
            className="p-1.5 rounded-md bg-[#1e2230] hover:bg-[#252b3d] text-slate-300 border border-[#2a2f42] transition"
            title="Refresh library"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Sub-header / Scan Status */}
        {scanning && progress && (
          <div className="bg-[#181d2c] border-b border-blue-500/30 px-5 py-2.5 flex flex-col space-y-1.5 transition-all">
            <div className="flex justify-between items-center text-xs">
              <span className="text-blue-400 font-medium flex items-center space-x-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Scanning: {progress.currentPath}</span>
              </span>
              <span className="text-slate-400 font-mono">
                {progress.scannedFiles} / {progress.totalFiles || "?"} files
              </span>
            </div>
            <div className="w-full bg-[#10131d] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-200"
                style={{
                  width: `${scanPercent(progress.scannedFiles, progress.totalFiles)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="h-12 border-b border-[#222738] bg-[#12151e] px-5 flex items-center justify-between">
          <div className="relative w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, artist, album, path..."
              className="w-full bg-[#1a1e2b] border border-[#2a2f42] rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500 transition"
            />
          </div>

          <div className="flex items-center space-x-4 text-xs text-slate-400">
            <span className="flex items-center space-x-1">
              <HardDrive className="w-3.5 h-3.5 text-slate-500" />
              <span>{filteredTracks.length} tracks</span>
            </span>
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Local-first & Non-destructive</span>
            </span>
          </div>
        </div>

        {/* Track List Table */}
        <div className="flex-1 overflow-auto">
          {filteredTracks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3 p-8">
              <div className="h-16 w-16 rounded-2xl bg-[#181b26] border border-[#262c3e] flex items-center justify-center">
                <Music className="w-8 h-8 text-slate-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-300">No tracks in library</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Click "Scan Music Folder" above to import your local audio files (.mp3, .flac,
                  .wav, .aiff).
                </p>
              </div>
              {currentFolder && (
                <div className="text-xs bg-[#161924] border border-[#262a3a] px-3 py-1 rounded-sm text-slate-400 font-mono">
                  Current folder: {currentFolder}
                </div>
              )}
            </div>
          ) : (
            <table className="w-full min-w-[1200px] text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#222738] bg-[#141722] text-slate-400 uppercase tracking-wider text-[10px] font-semibold sticky top-0 z-10">
                  <th className="py-2.5 px-4 w-12 text-center">#</th>
                  <th className="py-2.5 px-2 w-14 text-center">Art</th>
                  <th className="py-2.5 px-4">Title</th>
                  <th className="py-2.5 px-4">Artist</th>
                  <th className="py-2.5 px-4">Album</th>
                  <th className="py-2.5 px-4 w-16 text-center">BPM</th>
                  <th className="py-2.5 px-4 w-16 text-center">Key</th>
                  <th className="py-2.5 px-4 w-24 text-center">Rating</th>
                  <th className="py-2.5 px-4 w-20 text-center">
                    <Clock className="w-3.5 h-3.5 inline text-slate-500" />
                  </th>
                  <th className="py-2.5 px-4 w-20 text-center">Format</th>
                  <th className="py-2.5 px-4">Comments</th>
                  <th className="py-2.5 px-4 w-28 text-center">Fingerprint</th>
                  <th className="py-2.5 px-4 w-28 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b1f2d]">
                {filteredTracks.map((track, idx) => (
                  <tr key={track.id} className="hover:bg-[#181c28] transition duration-150 group">
                    <td className="py-2.5 px-4 text-center text-slate-500 font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-1.5 px-2">
                      <ArtworkThumb trackId={track.id} hasArtwork={!!track.artworkHash} />
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-100 group-hover:text-blue-400 transition">
                      {track.title || "Untitled"}
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">
                      {track.artist || "Unknown Artist"}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400">{track.album || "—"}</td>
                    <td className="py-2.5 px-4 text-center font-mono text-slate-300">
                      {formatBpm(track.bpm)}
                    </td>
                    <td
                      className="py-2.5 px-4 text-center font-mono text-slate-300"
                      title={
                        track.keyClassical && track.keyCamelot
                          ? `Camelot ${track.keyCamelot} • ${track.keyClassical}`
                          : undefined
                      }
                    >
                      {formatKey(track.keyCamelot, track.keyClassical)}
                    </td>
                    <td
                      className="py-2.5 px-4 text-center text-amber-400 tracking-tight"
                      title={track.userRating != null ? `${track.userRating} / 5` : "Unrated"}
                    >
                      {formatRating(track.userRating)}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono text-slate-400">
                      {formatDuration(track.durationMs)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="px-1.5 py-0.5 rounded-sm text-[10px] uppercase font-mono bg-[#212637] text-slate-300 border border-[#2e344a]">
                        {track.format || "AUDIO"}
                      </span>
                    </td>
                    <td
                      className="py-2.5 px-4 text-slate-400 italic"
                      title={track.comments ?? undefined}
                    >
                      {truncateComment(track.comments, 48)}
                    </td>
                    <td
                      className="py-2.5 px-4 text-center font-mono text-[10px] text-slate-400"
                      title={track.fileHash}
                    >
                      {shortHash(track.fileHash)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-sm text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Indexed</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Footer / Status Bar */}
      <footer className="h-7 border-t border-[#222738] bg-[#11131c] px-4 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center space-x-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>{statusMessage}</span>
        </div>
        <div className="font-mono text-[10px] text-slate-400">
          BLAKE3 Fingerprint • SQLite Core • Offline
        </div>
      </footer>
    </div>
  );
}
