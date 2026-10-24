import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

import { resolveLiveDatabasePath, samePath, seedLibraryFixture } from "./make-library-fixture.mjs";

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
    env.DJ_ASSISTANT_DB_PATH = join(dir, "override.db");
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

test("seedLibraryFixture protects the configured database and its sidecars", () => {
  const dir = tempDir();
  try {
    const live = join(dir, "configured.db");
    const env = { DJ_ASSISTANT_DB_PATH: relative(process.cwd(), live) };
    for (const suffix of ["", "-wal", "-shm"]) {
      writeFileSync(`${live}${suffix}`, `keep${suffix}`);
    }

    for (const suffix of ["", "-wal", "-shm"]) {
      assert.throws(
        () => seedLibraryFixture({ dbPath: `${live}${suffix}`, trackCount: 1, force: true, env }),
        /live app database/i
      );
    }
    for (const suffix of ["", "-wal", "-shm"]) {
      assert.equal(readFileSync(`${live}${suffix}`, "utf8"), `keep${suffix}`);
    }
    // The fixture also deletes its own sidecars before opening SQLite.
    assert.throws(
      () =>
        seedLibraryFixture({
          dbPath: join(dir, "another.db"),
          trackCount: 1,
          force: true,
          env: { DJ_ASSISTANT_DB_PATH: join(dir, "another.db-wal") },
        }),
      /live app database/i
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("seedLibraryFixture ignores an empty database override", () => {
  const dir = tempDir();
  try {
    const summary = seedLibraryFixture({
      dbPath: join(dir, "fixture.db"),
      trackCount: 1,
      env: { DJ_ASSISTANT_DB_PATH: "" },
    });
    assert.equal(summary.trackCount, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("samePath protects differently cased paths on macOS and Windows", () => {
  const dir = tempDir();
  try {
    const first = join(dir, "Library.db");
    const second = join(dir, "library.db");
    assert.equal(samePath(first, second, "darwin"), true);
    assert.equal(samePath(first, second, "win32"), true);
    if (process.platform === "linux") {
      assert.equal(samePath(first, second, "linux"), false);
    }
    assert.equal(samePath(first, join(dir, "other.db"), "darwin"), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("samePath resolves a symlinked parent and preserves nonexistent suffixes", () => {
  const dir = tempDir();
  try {
    const real = join(dir, "real");
    const alias = join(dir, "alias");
    mkdirSync(real);
    symlinkSync(real, alias, process.platform === "win32" ? "junction" : "dir");
    const live = join(real, "missing", "nested", "library.db");
    const target = join(alias, "missing", "nested", "library.db");
    assert.equal(samePath(live, target), true);
    assert.equal(samePath(live, join(alias, "missing", "other.db")), false);
    assert.throws(
      () =>
        seedLibraryFixture({
          dbPath: target,
          trackCount: 1,
          force: true,
          env: { DJ_ASSISTANT_DB_PATH: live },
        }),
      /live app database/i
    );
    assert.equal(existsSync(join(real, "missing")), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("samePath fails closed for unresolved symlinks", () => {
  const dir = tempDir();
  try {
    const dangling = join(dir, "dangling");
    const loop = join(dir, "loop");
    const linkType = process.platform === "win32" ? "junction" : "dir";
    symlinkSync(join(dir, "missing"), dangling, linkType);
    symlinkSync(loop, loop, linkType);
    const live = join(dir, "live.db");
    for (const parent of [dangling, loop]) {
      const target = join(parent, "fixture.db");
      assert.throws(() => samePath(live, target), /cannot safely resolve/i);
      assert.throws(
        () =>
          seedLibraryFixture({
            dbPath: target,
            trackCount: 1,
            force: true,
            env: { DJ_ASSISTANT_DB_PATH: live },
          }),
        /cannot safely resolve/i
      );
    }
    assert.equal(existsSync(join(dir, "missing")), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
