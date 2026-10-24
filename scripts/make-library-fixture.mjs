#!/usr/bin/env node
/**
 * Builds the 30,000-track QA library described in the Stage 2 acceptance work.
 *
 * The database is synthetic and disposable: it is written to an explicit
 * `--out` path, never to the app's live database, and the app reaches it via
 * `DJ_ASSISTANT_DB_PATH`. Rows are deterministic (index arithmetic, no random
 * source), so two runs over the same track count produce identical data and a
 * QA timing can be compared across builds.
 *
 * Usage: node scripts/make-library-fixture.mjs --out <path> [--tracks N] [--force]
 */

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../apps/desktop/src-tauri/migrations", import.meta.url)
);
const APP_ID = "com.djassistant.desktop";
const DB_FILE = "dj_assistant.db";
const DEFAULT_TRACK_COUNT = 30_000;

const GENRES = [
  "House",
  "Techno",
  "Trance",
  "Drum & Bass",
  "Progressive House",
  "Minimal",
  "Deep House",
  "Tech House",
  "Breaks",
  "Ambient",
  "Garage",
  "Disco",
];
const CLASSICAL_KEYS = [
  "A minor",
  "C major",
  "F# minor",
  "B major",
  "D minor",
  "G major",
  "E minor",
  "A major",
];
const FORMATS = ["mp3", "flac", "aiff", "wav"];

/** `list_tracks` sends `imported_at`; the fixture staggers `created_at` by a minute. */
const FIXTURE_EPOCH = Date.UTC(2025, 0, 1);

const TRACK_COLUMNS = [
  "id",
  "workspace_id",
  "file_path",
  "file_hash",
  "file_size",
  "duration_ms",
  "sample_rate",
  "channels",
  "bit_depth",
  "format",
  "title",
  "artist",
  "album",
  "genre",
  "year",
  "bpm",
  "key_camelot",
  "key_classical",
  "loudness_lufs",
  "spectral_brightness",
  "vocal_presence",
  "phrase_confidence",
  "analysis_status",
  "analysis_version",
  "user_rating",
  "play_count",
  "notes",
  "created_at",
  "updated_at",
  "comments",
  "isrc",
  "energy",
  "label",
];

/**
 * Where the desktop app keeps its real library unless `DJ_ASSISTANT_DB_PATH`
 * overrides it. Mirrors Tauri's `app_data_dir` on each platform.
 */
export function resolveLiveDatabasePath(env = process.env, platform = process.platform) {
  let base;
  if (platform === "win32") {
    base = env.APPDATA;
  } else if (platform === "darwin") {
    base = env.HOME ? join(env.HOME, "Library", "Application Support") : undefined;
  } else {
    base = env.XDG_DATA_HOME ?? (env.HOME ? join(env.HOME, ".local", "share") : undefined);
  }
  return base ? join(base, APP_ID, DB_FILE) : null;
}

function canonicalPath(path) {
  let ancestor = resolve(path);
  const suffix = [];
  while (true) {
    try {
      return join(realpathSync(ancestor), ...suffix);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw new Error(`cannot safely resolve database path ${path}`, { cause: error });
      }
      // An existing but dangling symlink is not a nonexistent path suffix.
      if (lstatSync(ancestor, { throwIfNoEntry: false })) {
        throw new Error(`cannot safely resolve database path ${path}`, { cause: error });
      }
      const parent = dirname(ancestor);
      if (parent === ancestor) {
        throw new Error(`cannot safely resolve database path ${path}`, { cause: error });
      }
      suffix.unshift(basename(ancestor));
      ancestor = parent;
    }
  }
}

export function samePath(left, right, platform = process.platform) {
  const a = canonicalPath(left);
  const b = canonicalPath(right);
  // Conservatively protect case aliases even on case-sensitive macOS volumes.
  return platform === "win32" || platform === "darwin"
    ? a.toLowerCase() === b.toLowerCase()
    : a === b;
}

function timestamp(index) {
  return new Date(FIXTURE_EPOCH + index * 60_000).toISOString().replace("T", " ").slice(0, 19);
}

function trackRow(index) {
  const status =
    index % 20 === 0
      ? "pending"
      : index % 20 === 1
        ? "failed"
        : index % 20 === 2
          ? "needs_review"
          : "complete";
  const genre = GENRES[index % GENRES.length];
  const genreSlug = genre.toLowerCase().replaceAll("&", "and").replaceAll(" ", "-");
  const sequence = String(index + 1).padStart(5, "0");
  const format = FORMATS[index % FORMATS.length];
  const createdAt = timestamp(index);

  return {
    id: `qa-track-${sequence}`,
    workspace_id: "default",
    file_path: `qa-library/${genreSlug}/artist-${String(index % 400).padStart(3, "0")}/track-${sequence}.${format}`,
    file_hash: index.toString(16).padStart(64, "0"),
    file_size: 2_500_000 + (index % 7_500_000),
    duration_ms: 90_000 + (index % 320) * 1_000,
    sample_rate: index % 2 === 0 ? 44_100 : 48_000,
    channels: 2,
    bit_depth: 16,
    format,
    title: `Synthetic Track ${sequence}`,
    artist: `Artist ${String(index % 400).padStart(3, "0")}`,
    album: `Album ${String(Math.floor(index / 12) % 300).padStart(3, "0")}`,
    genre,
    year: 1985 + (index % 40),
    bpm: 66 + (index % 118) + (index % 2) * 0.5,
    key_camelot: `${(index % 12) + 1}${index % 2 === 0 ? "A" : "B"}`,
    key_classical: CLASSICAL_KEYS[index % CLASSICAL_KEYS.length],
    loudness_lufs: -(6 + (index % 10)) - (index % 2) * 0.5,
    spectral_brightness: (index % 100) / 100,
    vocal_presence: index % 3 === 0 ? 1 : 0,
    phrase_confidence: 0.2 + (index % 80) / 100,
    analysis_status: status,
    analysis_version: status === "complete" ? "qa-fixture-1" : null,
    user_rating: index % 7 === 0 ? null : index % 6,
    play_count: index % 25,
    notes: null,
    created_at: createdAt,
    updated_at: createdAt,
    comments: index % 5 === 0 ? `Synthetic comment for track ${index + 1}` : null,
    isrc: index % 3 === 0 ? `QA${String(index + 1).padStart(9, "0")}` : null,
    energy: index % 11 === 0 ? null : (index % 10) + 1,
    label: index % 4 === 0 ? `Label ${String(index % 50).padStart(2, "0")}` : null,
  };
}

function tagsFor(index) {
  const tags = [];
  if (index % 3 === 0) tags.push("warmup");
  if (index % 5 === 0) tags.push("peak-time");
  if (index % 7 === 0) tags.push("vocal");
  return tags;
}

function readMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => ({
      version: Number.parseInt(file, 10),
      sql: readFileSync(join(MIGRATIONS_DIR, file), "utf8"),
    }));
}

function assertTrackCount(trackCount) {
  if (!Number.isInteger(trackCount) || trackCount <= 0) {
    throw new Error(`trackCount must be a positive integer (received ${trackCount})`);
  }
}

export function seedLibraryFixture({
  dbPath,
  trackCount = DEFAULT_TRACK_COUNT,
  force = false,
  env = process.env,
} = {}) {
  assertTrackCount(trackCount);
  if (typeof dbPath !== "string" || dbPath.trim() === "") {
    throw new Error("dbPath is required");
  }

  const target = resolve(dbPath);
  const suffixes = ["", "-wal", "-shm"];
  const outputPaths = suffixes.map((suffix) => `${target}${suffix}`);
  for (const livePath of [env.DJ_ASSISTANT_DB_PATH, resolveLiveDatabasePath(env)]) {
    if (
      livePath &&
      outputPaths.some((output) =>
        suffixes.some((suffix) => samePath(output, `${livePath}${suffix}`))
      )
    ) {
      throw new Error(`refusing to write the fixture over the live app database (${livePath})`);
    }
  }
  if (existsSync(target) && !force) {
    throw new Error(`refusing to overwrite ${target}: it already exists; pass --force`);
  }

  const migrations = readMigrations();
  if (migrations.length === 0) {
    throw new Error(`no migrations found in ${MIGRATIONS_DIR}`);
  }

  mkdirSync(dirname(target), { recursive: true });
  for (const output of outputPaths) {
    rmSync(output, { force: true });
  }

  const db = new DatabaseSync(target);
  try {
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);

    let tagCount = 0;
    db.exec("BEGIN");
    try {
      for (const migration of migrations) {
        db.exec(migration.sql);
        db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(migration.version);
      }

      const insertTrack = db.prepare(
        `INSERT INTO tracks (${TRACK_COLUMNS.join(", ")})
         VALUES (${TRACK_COLUMNS.map(() => "?").join(", ")})`
      );
      const insertTag = db.prepare("INSERT INTO track_tags (track_id, tag) VALUES (?, ?)");

      for (let index = 0; index < trackCount; index += 1) {
        const row = trackRow(index);
        insertTrack.run(...TRACK_COLUMNS.map((column) => row[column]));
        for (const tag of tagsFor(index)) {
          insertTag.run(row.id, tag);
          tagCount += 1;
        }
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    return {
      dbPath: target,
      trackCount,
      tagCount,
      migrationCount: migrations.length,
    };
  } finally {
    db.close();
  }
}

function parseArgs(argv) {
  const options = { dbPath: null, trackCount: DEFAULT_TRACK_COUNT, force: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") {
      options.dbPath = argv[index + 1] ?? null;
      index += 1;
    } else if (arg === "--tracks") {
      options.trackCount = Number(argv[index + 1]);
      index += 1;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return options;
}

function printUsage() {
  console.log("Usage: node scripts/make-library-fixture.mjs --out <path> [--tracks N] [--force]");
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printUsage();
    } else if (!options.dbPath) {
      printUsage();
      throw new Error("--out <path> is required");
    } else {
      const summary = seedLibraryFixture(options);
      console.log(
        `Seeded ${summary.trackCount.toLocaleString("en-US")} tracks and ` +
          `${summary.tagCount.toLocaleString("en-US")} tags into ${summary.dbPath} ` +
          `(${summary.migrationCount} migrations).`
      );
      console.log(
        "Synthetic QA data only. Point the desktop app at it with " +
          `DJ_ASSISTANT_DB_PATH=${summary.dbPath}`
      );
    }
  } catch (error) {
    console.error(`make-library-fixture: ${error.message}`);
    process.exitCode = 1;
  }
}
