import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { initDb, insertImportResult, listReviewItems, queueRecords, summarizeDb } from "../src/db.ts";
import type { ClassificationResult } from "../src/importer.ts";

test("persists imported records, review items, and generated queue items", () => {
  const dir = mkdtempSync(join(tmpdir(), "xen-db-"));
  const dbPath = join(dir, "xen.sqlite");
  const result: ClassificationResult = {
    records: [
      {
        id: 1,
        sheet: "X3-e599",
        rowNumber: 47,
        wallet: "0x2222222222222222222222222222222222222222",
        label: "21501-22000",
        ranges: [{ start: 21501, end: 22000 }],
        rangeCount: 500,
        quantity: 500,
        status: "claimable",
        mintDate: "2025-03-22",
        expiryDate: "2026-05-02",
        termDays: 406,
      },
    ],
    needsReview: [
      {
        sheet: "X5-694c",
        rowNumber: 18,
        wallet: "0x4444444444444444444444444444444444444444",
        label: "16001-17000",
        quantity: 1000,
        rangeCount: 1000,
        reason: "Missing expiry date",
      },
    ],
    summary: {},
  };

  initDb(dbPath);
  insertImportResult(dbPath, result, "unit.xlsx");
  const queue = queueRecords(dbPath);

  assert.equal(queue.inserted, 5);
  assert.deepEqual(summarizeDb(dbPath), {
    active_mint: 0,
    claimable: 500,
    claimed: 0,
    planned_mint: 0,
    needs_review: 1000,
    queued_claim_remint: 500,
    queued_planned_mint: 0,
  });
  assert.equal(listReviewItems(dbPath).length, 1);
});
