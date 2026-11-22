// Seeds tag spelling variants into a QA fixture and writes a baseline snapshot.
// Usage: node scripts/qa/fixture-run/seed.mjs <fixture.db> <baseline.json>
// Only case, spacing and accent variants are seeded: the Tag Surgeon scan skips
// spellings that differ in punctuation (tag_clustering::cluster_tags).
import { DatabaseSync } from "node:sqlite";
import { writeFileSync } from "node:fs";

const dbPath = process.argv[2];
const baselinePath = process.argv[3];
if (!dbPath || !baselinePath) {
  console.error("usage: seed.mjs <fixture.db> <baseline.json>");
  process.exit(2);
}

const db = new DatabaseSync(dbPath);
const insert = db.prepare("INSERT OR IGNORE INTO track_tags (track_id, tag) VALUES (?, ?)");
const seeds = [
  ["qa-track-00001", "Dark Groove"],
  ["qa-track-00002", "dark groove"],
  ["qa-track-00003", "DARK  GROOVE"],
  ["qa-track-00004", "Dárk Groove"],
];

db.exec("BEGIN");
db.prepare("DELETE FROM track_tags WHERE tag IN ('Peak Time', 'peaktime', 'Peak-Time')").run();
for (const [trackId, tag] of seeds) insert.run(trackId, tag);
db.exec("COMMIT");

const baseline = {
  tracks: db.prepare("SELECT COUNT(*) AS n FROM tracks").get().n,
  track_tags: db.prepare("SELECT COUNT(*) AS n FROM track_tags").get().n,
  tag_rows: db.prepare("SELECT track_id, tag FROM track_tags ORDER BY 1, 2").all(),
};
writeFileSync(baselinePath, JSON.stringify(baseline, null, 1));
console.log(`seeded; tracks=${baseline.tracks} track_tags=${baseline.track_tags}`);
