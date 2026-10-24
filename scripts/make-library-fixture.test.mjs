import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

import { resolveLiveDatabasePath, seedLibraryFixture } from "./make-library-fixture.mjs";

function tempDir() {
  return mkdtempSync(join(tmpdir(), "dj-library-fixture-"));
}

function withDatabase(dbPath, check) {
  const db = new DatabaseSync(dbPath);
  try {
    return check(db);
  } finally {
    db.close();
  }
}

test("seedLibraryFixture applies every migration and seeds the workspace", () => {
  const dir = tempDir();
  try {
    const dbPath = join(dir, "library.db");
    const summary = seedLibraryFixture({ dbPath, trackCount: 40 });

    assert.equal(summary.trackCount, 40);
    assert.equal(summary.migrationCount, 7);

    withDatabase(dbPath, (db) => {
      const versions = db
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .all()
        .map((row) => row.version);
      assert.deepEqual(versions, [1, 2, 3, 4, 5, 6, 7]);
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM tracks").get().n, 40);
      assert.equal(db.prepare("SELECT id FROM workspaces").get().id, "default");
      assert.ok(
        db.prepare("SELECT COUNT(*) AS n FROM track_tags").get().n > 0,
        "the fixture must exercise the tag join"
      );
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("seedLibraryFixture is deterministic and spans every filter value", () => {
  const dir = tempDir();
  try {
    const first = join(dir, "first.db");
    const second = join(dir, "second.db");
    seedLibraryFixture({ dbPath: first, trackCount: 60 });
    seedLibraryFixture({ dbPath: second, trackCount: 60 });

    const readRows = (dbPath) =>
      withDatabase(dbPath, (db) =>
        db
          .prepare("SELECT id, title, artist, bpm, energy, user_rating FROM tracks ORDER BY id")
          .all()
          .map((row) => [row.id, row.title, row.artist, row.bpm, row.energy, row.user_rating])
      );

    assert.deepEqual(readRows(first), readRows(second));

    withDatabase(first, (db) => {
      const rows = db.prepare("SELECT bpm, energy, user_rating FROM tracks").all();
      const statuses = db
        .prepare("SELECT DISTINCT analysis_status AS value FROM tracks")
        .all()
        .map((row) => row.value)
        .sort();
      const genres = db.prepare("SELECT DISTINCT genre AS value FROM tracks").all();

      assert.deepEqual(statuses, ["complete", "failed", "needs_review", "pending"]);
      assert.equal(genres.length, 12);
      assert.ok(rows.some((row) => row.energy === null));
      assert.ok(rows.some((row) => row.user_rating === null));
      for (const row of rows) {
        assert.ok(row.bpm > 60 && row.bpm < 200, `bpm out of range: ${row.bpm}`);
        assert.ok(
          row.energy === null || (row.energy >= 1 && row.energy <= 10),
          `energy out of range: ${row.energy}`
        );
        assert.ok(
          row.user_rating === null || (row.user_rating >= 0 && row.user_rating <= 5),
          `rating out of range: ${row.user_rating}`
        );
      }
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("seedLibraryFixture refuses to overwrite an existing library without force", () => {
  const dir = tempDir();
  try {
    const dbPath = join(dir, "library.db");
    seedLibraryFixture({ dbPath, trackCount: 12 });

    assert.throws(() => seedLibraryFixture({ dbPath, trackCount: 12 }), /already exists/i);

    const summary = seedLibraryFixture({ dbPath, trackCount: 7, force: true });
    assert.equal(summary.trackCount, 7);
    withDatabase(dbPath, (db) => {
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM tracks").get().n, 7);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("seedLibraryFixture refuses the live app database even with force", () => {
  const dir = tempDir();
  try {
    const env =
      process.platform === "win32"
        ? { APPDATA: join(dir, "appdata") }
        : process.platform === "darwin"
          ? { HOME: join(dir, "home") }
          : { HOME: join(dir, "home"), XDG_DATA_HOME: join(dir, "data") };
    const live = resolveLiveDatabasePath(env);
    assert.ok(live, "every supported platform must resolve a live database path");

    assert.throws(
      () => seedLibraryFixture({ dbPath: live, trackCount: 1, force: true, env }),
      /live app database/i
    );
    assert.equal(existsSync(live), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("seedLibraryFixture rejects non-positive and fractional track counts", () => {
  const dir = tempDir();
  try {
    for (const trackCount of [0, -1, 1.5, Number.NaN]) {
      assert.throws(
        () => seedLibraryFixture({ dbPath: join(dir, "invalid.db"), trackCount }),
        /positive integer/i
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
