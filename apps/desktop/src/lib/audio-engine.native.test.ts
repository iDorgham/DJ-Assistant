import assert from "node:assert/strict";
import { test } from "node:test";
import { mockIPC } from "@tauri-apps/api/mocks";

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test("native loading discards stale continuations, gates play, restores volume", async () => {
  Object.assign(globalThis, { window: { __TAURI_INTERNALS__: {} } });
  const calls: { command: string; args: Record<string, unknown> }[] = [];
  const loads = new Map<string, ReturnType<typeof deferred<number>>>();
  const state = deferred<{ playing: boolean; positionMs: number }>();
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  Object.assign(globalThis, {
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  });
  mockIPC((command, args) => {
    const payload = args as Record<string, unknown>;
    calls.push({ command, args: payload });
    if (command === "audio_load") return loads.get(payload.trackId as string)!.promise;
    if (command === "audio_state") return state.promise;
  });
  const { previewEngine: engine } = await import("./audio-engine.ts");
  const { audioSeek } = await import("../services/api.ts");
  engine.setVolume(0.35);
  engine.setMuted(true);
  loads.set("a", deferred<number>());
  loads.set("b", deferred<number>());
  const first = engine.loadTrack("a", 20000);
  await flush();
  const second = engine.loadTrack("b", 30000);
  engine.play();
  await flush();
  // The engine dispatches each selection immediately and discards stale
  // continuations with its generation counter (the duration asserts below pin
  // that contract) — it does not queue the second load behind the first.
  assert.deepEqual(
    calls.filter((c) => c.command === "audio_load").map((c) => c.args.trackId),
    ["a", "b"]
  );
  assert.equal(
    calls.some((c) => c.command === "audio_play"),
    false
  );
  loads.get("a")!.resolve(99999);
  await first;
  await flush();
  assert.equal(engine.getState().durationMs, 30000);
  loads.get("b")!.resolve(45000);
  await second;
  await flush();
  assert.equal(engine.getState().durationMs, 45000);
  // The successful load pushes the retained (muted) volume, but the engine
  // never auto-dispatches audio_play: play is user-driven, which the explicit
  // play/pause/play below exercises once a track is loaded.
  const volumeCall = calls.find((c) => c.command === "audio_set_volume");
  assert.ok(volumeCall);
  assert.deepEqual(volumeCall.args, { volume: 0 });
  assert.equal(
    calls.some((c) => c.command === "audio_play"),
    false
  );
  engine.play();
  await flush();
  assert.equal(calls.filter((c) => c.command === "audio_play").length, 1);
  const poll = frames.values().next().value!;
  frames.clear();
  poll(0);
  await flush();
  engine.pause();
  engine.play();
  const currentFrames = frames.size;
  state.resolve({ playing: false, positionMs: 44000 });
  await flush();
  assert.equal(engine.getState().positionMs, 0);
  assert.equal(engine.getState().isPlaying, true);
  assert.equal(frames.size, currentFrames);
  engine.stop();

  loads.set("c", deferred<number>());
  const third = engine.loadTrack("c", 30000);
  engine.play();
  engine.pause();
  loads.get("c")!.resolve(50000);
  await third;
  await flush();
  assert.equal(engine.getState().isPlaying, false);
  engine.setMuted(false);
  loads.set("d", deferred<number>());
  const fourth = engine.loadTrack("d", 30000);
  loads.get("d")!.resolve(60000);
  await fourth;
  assert.deepEqual(calls.filter((c) => c.command === "audio_set_volume").at(-1)!.args, {
    volume: 0.35,
  });

  // Re-selecting the same ID still creates a distinct load request.
  const oldSame = deferred<number>();
  loads.set("same", oldSame);
  const oldRequest = engine.loadTrack("same", 30000);
  await flush();
  const newSame = deferred<number>();
  loads.set("same", newSame);
  const newRequest = engine.loadTrack("same", 40000);
  oldSame.resolve(99999);
  await oldRequest;
  await flush();
  assert.equal(engine.getState().durationMs, 40000);
  newSame.resolve(70000);
  await newRequest;
  assert.equal(engine.getState().durationMs, 70000);

  loads.set("broken", deferred<number>());
  const broken = engine.loadTrack("broken", 30000);
  await flush();
  loads.get("broken")!.reject(new Error("test decode failure"));
  await broken;
  loads.set("recovered", deferred<number>());
  const recovered = engine.loadTrack("recovered", 30000);
  loads.get("recovered")!.resolve(80000);
  await recovered;
  assert.equal(engine.getState().durationMs, 80000);

  // The engine records its own audio_seek(0) rewinds (stop/replay), so pin the
  // clamp matrix on the explicit calls rather than the whole transcript.
  const seekBaseline = calls.filter((c) => c.command === "audio_seek").length;
  for (const value of [1.6, -10, NaN, Infinity, -Infinity, 1e30]) await audioSeek(value);
  // Finite values clamp into [0, MAX_SAFE_INTEGER] and dispatch; non-finite
  // values are dropped outright (normalizeSeekMs), never coerced to a seek.
  assert.deepEqual(
    calls
      .filter((c) => c.command === "audio_seek")
      .slice(seekBaseline)
      .map((c) => c.args.ms),
    [2, 0, Number.MAX_SAFE_INTEGER]
  );
  engine.stop();
});

test("native stop rewinds, and a newer seek discards the deferred rewind", async () => {
  Object.assign(globalThis, { window: { __TAURI_INTERNALS__: {} } });
  const calls: { command: string; args: Record<string, unknown> }[] = [];
  const pauses: ReturnType<typeof deferred<null>>[] = [];
  mockIPC((command, args) => {
    const payload = args as Record<string, unknown>;
    calls.push({ command, args: payload });
    if (command === "audio_load") return Promise.resolve(20000);
    if (command === "audio_pause") return pauses.shift()?.promise ?? Promise.resolve();
    return undefined;
  });
  const { previewEngine: engine } = await import("./audio-engine.ts");
  await engine.loadTrack("stopcase", 20000);
  await flush(); // let the load's own rewind + volume restore land
  calls.length = 0;
  const seeks = () => calls.filter((c) => c.command === "audio_seek").map((c) => c.args.ms);

  pauses.push(deferred<null>());
  engine.stop();
  engine.seek(12000); // newer transport command, issued while the pause is in flight
  pauses[0].resolve(null);
  await flush();
  assert.deepEqual(seeks(), [12000], "the deferred rewind must not overwrite the newer seek");

  pauses.push(deferred<null>());
  engine.stop();
  pauses[0].resolve(null);
  await flush();
  assert.deepEqual(seeks(), [12000, 0], "an undisrupted stop still rewinds");
});

test("a late rejection from a superseded play() cannot stop the newer playback", async () => {
  Object.assign(globalThis, { window: { __TAURI_INTERNALS__: {} } });
  const plays: ReturnType<typeof deferred<null>>[] = [];
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  Object.assign(globalThis, {
    requestAnimationFrame: (cb: FrameRequestCallback) => {
      frames.set(++frameId, cb);
      return frameId;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  });
  mockIPC((command) => {
    if (command === "audio_load") return Promise.resolve(20000);
    if (command === "audio_play") {
      const d = deferred<null>();
      plays.push(d);
      return d.promise;
    }
    return undefined;
  });
  const { previewEngine: engine } = await import("./audio-engine.ts");
  await engine.loadTrack("playrace", 20000);
  await flush();
  engine.play(); // plays[0] in flight
  await flush();
  engine.pause();
  engine.play(); // plays[1] supersedes it
  await flush();
  assert.equal(plays.length, 2);
  assert.ok(frames.size > 0, "the newer play scheduled its poll");
  const baselineFrames = frames.size;
  plays[0].reject(new Error("device busy"));
  await flush();
  assert.equal(engine.getState().isPlaying, true, "superseded rejection must not stop playback");
  assert.equal(frames.size, baselineFrames, "the newer poll must keep running");
  plays[1].resolve(null);
  engine.stop();
  await flush();
});
