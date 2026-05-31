import test from "node:test";
import assert from "node:assert/strict";

import { chunkIds, countRanges, expandRanges, parseRangeCell, parseRangeLabel } from "../src/ranges.ts";

test("parses multiple newline-separated closed ranges without merging them", () => {
  const ranges = parseRangeCell("24001-24375\n26376-26500");

  assert.deepEqual(ranges, [
    { start: 24001, end: 24375 },
    { start: 26376, end: 26500 },
  ]);
  assert.equal(countRanges(ranges), 500);
});

test("expands closed ranges and chunks ids by a maximum batch size", () => {
  const ids = expandRanges([{ start: 21581, end: 21625 }]);

  assert.equal(ids.length, 45);
  assert.equal(ids[0], 21581);
  assert.equal(ids.at(-1), 21625);
  assert.deepEqual(
    chunkIds(expandRanges([{ start: 21876, end: 22000 }]), 80).map((chunk) => [
      chunk[0],
      chunk.at(-1),
      chunk.length,
    ]),
    [
      [21876, 21955, 80],
      [21956, 22000, 45],
    ],
  );
});

test("rejects invalid descending ranges", () => {
  assert.throws(() => parseRangeCell("20-10"), /Invalid range/);
});

test("parses remint F prefixes separately from execution ranges", () => {
  assert.deepEqual(parseRangeLabel("F 1-100"), {
    label: "F 1-100",
    baseLabel: "1-100",
    remintRound: 1,
    ranges: [{ start: 1, end: 100 }],
  });
  assert.deepEqual(parseRangeLabel("FF1-100"), {
    label: "FF1-100",
    baseLabel: "1-100",
    remintRound: 2,
    ranges: [{ start: 1, end: 100 }],
  });
  assert.deepEqual(parseRangeLabel("1-100"), {
    label: "1-100",
    baseLabel: "1-100",
    remintRound: 0,
    ranges: [{ start: 1, end: 100 }],
  });
});
