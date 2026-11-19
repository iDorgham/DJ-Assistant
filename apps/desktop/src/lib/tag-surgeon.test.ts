import assert from "node:assert/strict";
import { test } from "node:test";

import type { PrefixEdge, SpellingCluster, TagClusterReport } from "@dj-assistant/shared";

import {
  clusterHeading,
  edgeLabel,
  emptyReportMessage,
  hasFindings,
  ignoredTagsNote,
  memberLabel,
  scopeLabel,
} from "./tag-surgeon.ts";

const cluster: SpellingCluster = {
  key: "melodic house",
  members: [
    { raw: "Melodic House", trackCount: 3 },
    { raw: "melodic house ", trackCount: 1 },
  ],
  distinctTrackCount: 4,
  canonical: "Melodic House",
  rewriteTrackCount: 1,
};

const edge: PrefixEdge = {
  narrowerKey: "melodic house",
  narrowerLabel: "Melodic House",
  narrowerTracks: 1,
  broaderKey: "melodic house techno",
  broaderLabel: "Melodic House Techno",
  broaderTracks: 2,
  sharedPrefix: "melodic house",
};

const emptyReport: TagClusterReport = {
  scannedTags: 0,
  ignoredTags: 0,
  clusters: [],
  prefixEdges: [],
};

test("the scope subtitle counts tracks, not tags", () => {
  assert.equal(scopeLabel(1), "1 track");
  assert.equal(scopeLabel(12), "12 tracks");
});

test("the cluster heading is the representative raw spelling, never the fold key", () => {
  // members[0] is the representative by the engine's ordering rule; the fold
  // key ("melodic house") is internal and must not be what the dialog titles.
  assert.equal(clusterHeading(cluster), "Melodic House");
});

test("a member label shows the raw spelling and its track count", () => {
  assert.equal(memberLabel(cluster.members[0]), "Melodic House ×3");
  assert.equal(memberLabel(cluster.members[1]), "melodic house  ×1");
});

test("an edge label reads as a relation between displayable spellings", () => {
  assert.equal(edgeLabel(edge), "Melodic House ⊂ Melodic House Techno");
});

test("the ignored-tags note is singular, plural, or silent", () => {
  assert.equal(ignoredTagsNote(0), null);
  assert.equal(ignoredTagsNote(1), "1 tag is punctuation-only and was left alone");
  assert.equal(ignoredTagsNote(2), "2 tags are punctuation-only and were left alone");
});

test("the empty state is not an error and names the scope", () => {
  assert.equal(emptyReportMessage(1), "No duplicate spellings in this track.");
  assert.equal(emptyReportMessage(8), "No duplicate spellings in these 8 tracks.");
});

test("findings are clusters or edges; ignored-only is still empty", () => {
  assert.equal(hasFindings(emptyReport), false);
  assert.equal(hasFindings({ ...emptyReport, ignoredTags: 2 }), false);
  assert.equal(hasFindings({ ...emptyReport, clusters: [cluster] }), true);
  // The most interesting finding sits between two singletons: edges alone
  // must keep the dialog out of the empty state.
  assert.equal(hasFindings({ ...emptyReport, prefixEdges: [edge] }), true);
});
