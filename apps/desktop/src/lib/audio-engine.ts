/**
 * DJ Assistant Preview Audio Engine.
 *
 * Two backends share one public surface:
 * - **Tauri (native):** delegates load/play/pause/seek/volume to the Rust
 *   `AudioEngine` (Symphonia decode + cpal output) via the `audio_*` IPC
 *   wrappers in `services/api`. Position is polled from the native engine.
 * - **Web / tests:** a synthetic Web Audio beat generator stands in so the UI
 *   is usable outside the desktop shell and the unit tests stay deterministic.
 *
 * The beat grid, BPM calibration, and beat-jump are UI-only concerns in both
 * paths — the native engine plays the real file and reports position; the beat
 * counter is derived locally from BPM.
 */

import {
  audioLoad,
  audioPause,
  audioPlay,
  audioSeek,
  audioSetVolume,
  audioState,
} from "../services/api.ts";

export interface PlaybackState {
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  volume: number; // 0.0 - 1.0
  isMuted: boolean;
}

export type PlaybackListener = (state: PlaybackState) => void;

/**
 * True when a finished transport has to rewind before it can play again.
 *
 * Both backends leave the position on the last frame when a track ends, so
 * play() would otherwise restart from silence. A zero duration means nothing
 * usable is loaded and there is nothing to rewind to.
 */
export function shouldRewindToStart(positionMs: number, durationMs: number): boolean {
  return durationMs > 0 && positionMs >= durationMs;
}

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

class PreviewAudioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private positionMs = 0;
  private durationMs = 240000;
  private bpm = 124;
  private volume = 0.8;
  private isMuted = false;
  private listeners = new Set<PlaybackListener>();
  private masterGain: GainNode | null = null;
  private timerId: number | null = null;
  private lastRafTime = 0;
  private nextBeatTime = 0;
  private currentBeatIndex = 0;
  /** The trackId currently loaded into the native engine, if any. */
  private loadedTrackId: string | null = null;
  /**
   * Bumped by every `loadTrack` and `stop`. `audioLoad` is asynchronous: without
   * this, a load that resolves late would install its trackId and duration over
   * the track the user picked afterwards, and a late failure would clear a newer
   * load's trackId. `loadedTrackId` is also set only after a successful load, so
   * Play cannot resume the previous track while the next one is decoding.
   */
  private loadGeneration = 0;
  /**
   * Bumped by every transport change (play / pause / stop — `loadTrack` goes
   * through `stop`). A native `audio_state` reply that arrives afterwards
   * belongs to the previous session: applying it would repaint an old position
   * or revive the poll loop for a transport the user already stopped.
   */
  private pollGeneration = 0;

  constructor() {
    // AudioContext will be initialized on first user interaction (web path).
  }

  private initContext() {
    if (this.ctx) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.isMuted ? 0 : this.volume;
        this.masterGain.connect(this.ctx.destination);
      }
    } catch (e) {
      console.warn("AudioContext initialization skipped:", e);
    }
  }

  public subscribe(listener: PlaybackListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  public getState(): PlaybackState {
    return {
      isPlaying: this.isPlaying,
      positionMs: this.positionMs,
      durationMs: this.durationMs,
      volume: this.volume,
      isMuted: this.isMuted,
    };
  }

  /**
   * Load a track into the engine.
   *
   * `trackId` is optional for backwards compatibility with the synthetic path
   * and the unit tests. In Tauri, passing a `trackId` delegates to the native
   * `audio_load` command (real decode + playback); the returned duration is
   * authoritative. Without a `trackId` in Tauri, or outside Tauri, the
   * synthetic path uses `durationMs` as given.
   */
  public async loadTrack(durationMs: number, bpm?: number | null): Promise<void>;
  public async loadTrack(
    trackId: string | null,
    durationMs: number,
    bpm?: number | null
  ): Promise<void>;
  public async loadTrack(
    first: string | number | null,
    second?: number | null,
    bpm?: number | null
  ): Promise<void> {
    let trackId: string | null;
    let duration: number;
    let bpmVal: number;
    if (typeof first === "string" || first === null) {
      trackId = first;
      duration = Math.max(second || 180000, 10000);
      bpmVal = bpm && bpm > 40 && bpm < 240 ? bpm : 124;
    } else {
      trackId = null;
      duration = Math.max(first || 180000, 10000);
      bpmVal = second && second > 40 && second < 240 ? second : 124;
    }

    this.stop();
    // Captured after stop(): anything in flight from before this call — a
    // decode, a failed decode, a poll reply — is stale from here on.
    this.loadGeneration += 1;
    const generation = this.loadGeneration;

    this.bpm = bpmVal;
    this.durationMs = duration;
    this.positionMs = 0;
    this.currentBeatIndex = 0;

    if (isTauri && trackId) {
      try {
        const nativeDuration = await audioLoad(trackId);
        // A newer load or a stop owns the engine by now: keep its state.
        if (generation !== this.loadGeneration) return;
        this.loadedTrackId = trackId;
        if (nativeDuration > 0) {
          this.durationMs = nativeDuration;
        }
        // Volume and mute set before this load skipped IPC because nothing was
        // loaded, so Rust still holds its own 0.8 default. Push the retained
        // value now that a track is there.
        audioSetVolume(this.isMuted ? 0 : this.volume).catch((e) =>
          console.warn("Native audio_set_volume failed:", e)
        );
      } catch (e) {
        // The same staleness rule for a failure: it must not clear a newer track.
        if (generation !== this.loadGeneration) return;
        console.warn("Native audio_load failed, falling back to synthetic:", e);
        this.loadedTrackId = null;
      }
    } else {
      this.loadedTrackId = null;
    }

    this.notify();
  }

  public play() {
    this.pollGeneration += 1;

    if (isTauri && this.loadedTrackId) {
      this.isPlaying = true;
      // A finished track keeps its last position in the native engine, so a
      // replay has to rewind first — the synthetic path below does the same.
      if (shouldRewindToStart(this.positionMs, this.durationMs)) {
        this.positionMs = 0;
        this.currentBeatIndex = 0;
        audioSeek(0).catch((e) => console.warn("Native audio_seek failed:", e));
      }
      this.startNativePoll();
      audioPlay().catch((e) => {
        console.warn("Native audio_play failed:", e);
        this.isPlaying = false;
        this.stopNativePoll();
        this.notify();
      });
      this.notify();
      return;
    }

    // Synthetic path
    this.initContext();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    if (shouldRewindToStart(this.positionMs, this.durationMs)) {
      this.positionMs = 0;
      this.currentBeatIndex = 0;
    }

    this.isPlaying = true;
    this.lastRafTime = performance.now();
    const beatSec = 60 / this.bpm;
    this.nextBeatTime = this.ctx ? this.ctx.currentTime : 0;
    this.currentBeatIndex = Math.floor(this.positionMs / 1000 / beatSec);

    this.startSyntheticLoop();
    this.notify();
  }

  public pause() {
    this.pollGeneration += 1;

    if (isTauri && this.loadedTrackId) {
      this.isPlaying = false;
      this.stopNativePoll();
      audioPause().catch((e) => console.warn("Native audio_pause failed:", e));
      this.notify();
      return;
    }

    this.isPlaying = false;
    this.stopSyntheticLoop();
    this.notify();
  }

  public togglePlayPause() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public stop() {
    this.isPlaying = false;
    this.stopSyntheticLoop();
    this.stopNativePoll();
    // Neither a load still decoding nor a poll reply may revive what the caller
    // has just stopped.
    this.loadGeneration += 1;
    this.pollGeneration += 1;
    this.positionMs = 0;
    this.currentBeatIndex = 0;
    if (isTauri && this.loadedTrackId) {
      // Pause first, then rewind: a stopped transport must not keep playing from
      // the top, and so the next Play starts at the beginning.
      audioPause()
        .catch((e) => console.warn("Native audio_pause failed:", e))
        .then(() => audioSeek(0))
        .catch((e) => console.warn("Native audio_seek failed:", e));
    }
    this.notify();
  }

  public seek(targetMs: number) {
    const clamped = Math.max(0, Math.min(targetMs, this.durationMs));
    this.positionMs = clamped;
    const beatSec = 60 / this.bpm;
    this.currentBeatIndex = Math.floor(this.positionMs / 1000 / beatSec);

    if (isTauri && this.loadedTrackId) {
      audioSeek(clamped).catch((e) => console.warn("Native audio_seek failed:", e));
    } else {
      this.playScrubTick();
    }
    this.notify();
  }

  /** Live tempo calibration: beat jump and the synthesised preview follow it. */
  public setBpm(bpm: number) {
    this.bpm = bpm > 40 && bpm < 240 ? bpm : 124;
    this.currentBeatIndex = Math.floor(this.positionMs / 1000 / (60 / this.bpm));
  }

  public jumpBeats(beats: number) {
    const beatMs = (60 / this.bpm) * 1000;
    const deltaMs = beats * beatMs;
    this.seek(this.positionMs + deltaMs);
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx?.currentTime ?? 0);
    }
    if (isTauri && this.loadedTrackId) {
      audioSetVolume(this.isMuted ? 0 : this.volume).catch((e) =>
        console.warn("Native audio_set_volume failed:", e)
      );
    }
    this.notify();
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : this.volume, this.ctx?.currentTime ?? 0);
    }
    if (isTauri && this.loadedTrackId) {
      audioSetVolume(muted ? 0 : this.volume).catch((e) =>
        console.warn("Native audio_set_volume failed:", e)
      );
    }
    this.notify();
  }

  // --- Native polling loop ----------------------------------------------

  private nativePollId: number | null = null;

  private startNativePoll() {
    this.stopNativePoll();
    const generation = this.pollGeneration;
    const poll = async () => {
      if (!this.isPlaying) return;
      try {
        const s = await audioState();
        // The reply may outlive a pause, a stop or a load: drop it instead of
        // repainting a position that belongs to the previous session.
        if (generation !== this.pollGeneration) return;
        this.positionMs = Math.min(s.positionMs, this.durationMs);
        if (!s.playing) {
          // Engine paused underneath us (e.g. track ended). Reflect it.
          this.isPlaying = false;
          this.stopNativePoll();
        }
        this.notify();
      } catch (e) {
        console.warn("Native audio_state poll failed:", e);
      }
      // Do not schedule the next frame for a stale session either.
      if (this.isPlaying && generation === this.pollGeneration) {
        this.nativePollId = requestAnimationFrame(poll);
      }
    };
    this.nativePollId = requestAnimationFrame(poll);
  }

  private stopNativePoll() {
    if (this.nativePollId !== null) {
      cancelAnimationFrame(this.nativePollId);
      this.nativePollId = null;
    }
  }

  // --- Synthetic Web Audio loop (non-Tauri) -----------------------------

  private startSyntheticLoop() {
    this.stopSyntheticLoop();
    const tick = () => {
      if (!this.isPlaying) return;

      const now = performance.now();
      const delta = now - this.lastRafTime;
      this.lastRafTime = now;

      this.positionMs += delta;

      if (this.positionMs >= this.durationMs) {
        this.positionMs = this.durationMs;
        this.pause();
        return;
      }

      // Trigger synthetic beat sound if audio context is running
      this.scheduleBeats();

      this.notify();
      this.timerId = requestAnimationFrame(tick);
    };

    this.timerId = requestAnimationFrame(tick);
  }

  private stopSyntheticLoop() {
    if (this.timerId !== null) {
      cancelAnimationFrame(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Generates a clean synthetic preview sound for DJ preparation:
   * - Punchy kick on beat 1, 2, 3, 4
   * - Crisp high-frequency hat on off-beats
   * - Snare on beats 2 and 4
   */
  private scheduleBeats() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const beatSec = 60 / this.bpm;
    const currentAudioTime = this.ctx.currentTime;

    while (this.nextBeatTime < currentAudioTime + 0.1) {
      if (this.nextBeatTime >= currentAudioTime - 0.05) {
        this.synthesizeBeat(this.nextBeatTime, this.currentBeatIndex % 4);
      }
      this.nextBeatTime += beatSec;
      this.currentBeatIndex++;
    }
  }

  private synthesizeBeat(time: number, beatMod4: number) {
    if (!this.ctx || !this.masterGain) return;

    // Kick Drum (deep sine sweep)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const isDownbeat = beatMod4 === 0;
    const startFreq = isDownbeat ? 140 : 110;
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.07);

    const kickVol = isDownbeat ? 0.45 : 0.35;
    gain.gain.setValueAtTime(kickVol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.1);

    // Snare / Clap on 2 and 4 (beatMod4 === 1 or 3)
    if (beatMod4 === 1 || beatMod4 === 3) {
      const snareNoise = this.createNoiseBufferNode(0.05);
      if (snareNoise) {
        const snareGain = this.ctx.createGain();
        snareGain.gain.setValueAtTime(0.18, time);
        snareGain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

        const filter = this.ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.setValueAtTime(1000, time);

        snareNoise.connect(filter);
        filter.connect(snareGain);
        snareGain.connect(this.masterGain);

        snareNoise.start(time);
        snareNoise.stop(time + 0.06);
      }
    }

    // Offbeat hi-hat (halfway through beat)
    const hatTime = time + (60 / this.bpm) * 0.5;
    const hatNoise = this.createNoiseBufferNode(0.025);
    if (hatNoise) {
      const hatGain = this.ctx.createGain();
      hatGain.gain.setValueAtTime(0.12, hatTime);
      hatGain.gain.exponentialRampToValueAtTime(0.001, hatTime + 0.025);

      const hatFilter = this.ctx.createBiquadFilter();
      hatFilter.type = "highpass";
      hatFilter.frequency.setValueAtTime(6000, hatTime);

      hatNoise.connect(hatFilter);
      hatFilter.connect(hatGain);
      hatGain.connect(this.masterGain);

      hatNoise.start(hatTime);
      hatNoise.stop(hatTime + 0.03);
    }
  }

  private createNoiseBufferNode(duration: number): AudioBufferSourceNode | null {
    if (!this.ctx) return null;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    return noise;
  }

  private playScrubTick() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.015);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.02);
    } catch {
      // Best-effort scrub click
    }
  }
}

export const previewEngine = new PreviewAudioEngine();
