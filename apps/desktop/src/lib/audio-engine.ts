/**
 * DJ Assistant Web Audio Preview Engine
 * Provides precise playback timing, beat synthesis for preview, and cue auditioning.
 */

export interface PlaybackState {
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  volume: number; // 0.0 - 1.0
  isMuted: boolean;
}

export type PlaybackListener = (state: PlaybackState) => void;

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

  constructor() {
    // AudioContext will be initialized on first user interaction
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

  public loadTrack(durationMs: number, bpm?: number | null) {
    this.stop();
    this.durationMs = Math.max(durationMs || 180000, 10000);
    this.bpm = bpm && bpm > 40 && bpm < 240 ? bpm : 124;
    this.positionMs = 0;
    this.currentBeatIndex = 0;
    this.notify();
  }

  public play() {
    this.initContext();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    if (this.positionMs >= this.durationMs) {
      this.positionMs = 0;
      this.currentBeatIndex = 0;
    }

    this.isPlaying = true;
    this.lastRafTime = performance.now();
    const beatSec = 60 / this.bpm;
    this.nextBeatTime = this.ctx ? this.ctx.currentTime : 0;
    this.currentBeatIndex = Math.floor(this.positionMs / 1000 / beatSec);

    this.startLoop();
    this.notify();
  }

  public pause() {
    this.isPlaying = false;
    this.stopLoop();
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
    this.stopLoop();
    this.positionMs = 0;
    this.currentBeatIndex = 0;
    this.notify();
  }

  public seek(targetMs: number) {
    this.positionMs = Math.max(0, Math.min(targetMs, this.durationMs));
    const beatSec = 60 / this.bpm;
    this.currentBeatIndex = Math.floor(this.positionMs / 1000 / beatSec);
    this.playScrubTick();
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
    this.notify();
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : this.volume, this.ctx?.currentTime ?? 0);
    }
    this.notify();
  }

  private startLoop() {
    this.stopLoop();
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

  private stopLoop() {
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
