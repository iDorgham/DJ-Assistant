import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  PrefixEdge,
  SpellingCluster,
  TagClusterReport,
  TagPreviewTrack,
} from "@dj-assistant/shared";

import {
  aliasLabel,
  appliedLabel,
  clusterHeading,
  confirmLabel,
  edgeLabel,
  emptyReportMessage,
  hasFindings,
  ignoredTagsNote,
  memberLabel,
  moreAffectedNote,
  previewSampleIds,
  renamesFor,
  rewriteLabel,
  sampleSpellings,
  sampleTitle,
  scopeLabel,
  undoneLabel,
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
  sampleTrackIds: ["t-melodic"],
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

test("the rewrite headline counts the rewrite set and names the canonical spelling", () => {
  assert.equal(rewriteLabel(cluster), '1 track would change to "Melodic House"');
  assert.equal(
    rewriteLabel({ ...cluster, rewriteTrackCount: 12 }),
    '12 tracks would change to "Melodic House"'
  );
});

test("the sample note names only the affected tracks the sample list does not show", () => {
  assert.equal(moreAffectedNote(cluster), null);
  assert.equal(
    moreAffectedNote({ ...cluster, rewriteTrackCount: 7, sampleTrackIds: ["a", "b"] }),
    "and 5 more"
  );
});

test("the preview fetches each sample track once, across clusters", () => {
  const second: SpellingCluster = {
    ...cluster,
    key: "deep house",
    sampleTrackIds: ["t-melodic", "t-deep"],
  };
  assert.deepEqual(previewSampleIds({ ...emptyReport, clusters: [cluster, second] }), [
    "t-melodic",
    "t-deep",
  ]);
  assert.deepEqual(previewSampleIds(emptyReport), []);
});

test("a sample lists its title, artist and only the spellings a rewrite would change", () => {
  const track: TagPreviewTrack = {
    trackId: "t-melodic",
    title: "Night Drive",
    artist: "Someone",
    tags: ["Melodic House", "melodic house ", "Melodic House"],
  };
  assert.equal(sampleTitle(track), "Night Drive — Someone");
  // The canonical spelling stays off the list; a whitespace-only variant is
  // a real change, so it stays on, and a repeated tag is shown once.
  const members = ["Melodic House", "melodic house "];
  assert.deepEqual(sampleSpellings(track, "Melodic House", members), ["melodic house "]);
  // A tag that is not a member of this cluster is not a change, even on a track
  // that also carries cluster members.
  const withUnrelated: TagPreviewTrack = { ...track, tags: ["Melodic House", "Peak Time"] };
  assert.deepEqual(sampleSpellings(withUnrelated, "Melodic House", members), []);
});

test("a scan's renames map every non-canonical spelling onto the canonical one", () => {
  const report: TagClusterReport = { ...emptyReport, clusters: [cluster] };
  // The cluster's members are "Melodic House" (canonical) and "melodic house ".
  assert.deepEqual(renamesFor(report), [{ from: "melodic house ", to: "Melodic House" }]);
  assert.deepEqual(renamesFor(emptyReport), []);
});

test("the apply lines say how many spellings change and how many tracks did", () => {
  assert.equal(confirmLabel(1), "1 spelling will be replaced in the tracks that carry it.");
  assert.equal(confirmLabel(3), "3 spellings will be replaced in the tracks that carry them.");
  assert.equal(appliedLabel(0), "Nothing to change — the tags already match.");
  assert.equal(appliedLabel(4), "Changed 4 tracks. Undo is available until you close this dialog.");
});

test("an alias row reads as the spelling typed, then the spelling it saves as", () => {
  assert.equal(
    aliasLabel({ alias: "melodic h", canonical: "melodic house" }),
    "melodic h → melodic house"
  );
});

test("the undo line reports tracks left alone when they were edited since", () => {
  assert.equal(undoneLabel(1, 0), "Restored 1 track.");
  assert.equal(
    undoneLabel(2, 1),
    "Restored 2 tracks; 1 edited since the change, left as they are."
  );
});
