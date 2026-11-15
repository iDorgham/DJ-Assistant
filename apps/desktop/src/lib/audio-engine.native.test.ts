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

test("native loading serializes selections, gates play, restores volume and rejects stale polls", async () => {
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
  assert.deepEqual(
    calls.filter((c) => c.command === "audio_load").map((c) => c.args.trackId),
    ["a"]
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
  const volumeIndex = calls.findIndex((c) => c.command === "audio_set_volume");
  assert.equal(calls[volumeIndex].args.volume, 0);
  assert.ok(calls.findIndex((c) => c.command === "audio_play") > volumeIndex);
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

  for (const value of [1.6, -10, NaN, Infinity, -Infinity, 1e30]) await audioSeek(value);
  assert.deepEqual(
    calls.filter((c) => c.command === "audio_seek").map((c) => c.args.ms),
    [2, 0, 0, Number.MAX_SAFE_INTEGER, 0, Number.MAX_SAFE_INTEGER]
  );
  engine.stop();
});
