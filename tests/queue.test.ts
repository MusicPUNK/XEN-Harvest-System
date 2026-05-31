import test from "node:test";
import assert from "node:assert/strict";

import { buildQueueItems } from "../src/queue.ts";

test("builds claim+remint queue chunks with a maximum of 100 ids", () => {
  const items = buildQueueItems([
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
      expiryDate: "2026-05-02",
      mintDate: "2025-03-22",
      termDays: 406,
    },
  ]);

  assert.equal(items.length, 5);
  assert.deepEqual(
    items.map((item) => [item.kind, item.ids[0], item.ids.at(-1), item.ids.length]),
    [
      ["claim_remint", 21501, 21600, 100],
      ["claim_remint", 21601, 21700, 100],
      ["claim_remint", 21701, 21800, 100],
      ["claim_remint", 21801, 21900, 100],
      ["claim_remint", 21901, 22000, 100],
    ],
  );
});

test("builds planned mint queue chunks separately from claim+remint", () => {
  const items = buildQueueItems([
    {
      id: 9,
      sheet: "X7-8f39",
      rowNumber: 37,
      wallet: "0x1111111111111111111111111111111111111111",
      label: "35001-36000",
      ranges: [{ start: 35001, end: 36000 }],
      rangeCount: 1000,
      quantity: 1000,
      status: "planned_mint",
      expiryDate: null,
      mintDate: null,
      termDays: null,
    },
  ]);

  assert.equal(items.length, 20);
  assert.equal(items[0].kind, "planned_mint");
  assert.equal(items[0].ids.length, 50);
  assert.deepEqual(items[0].ids, Array.from({ length: 50 }, (_, index) => 35001 + index));
  assert.equal(items.at(-1)!.ids.length, 50);
});

test("keeps claim+remint at 100 while planned mint uses 50", () => {
  const items = buildQueueItems([
    {
      id: 1,
      sheet: "X3-e599",
      rowNumber: 47,
      wallet: "0x2222222222222222222222222222222222222222",
      label: "21501-21700",
      ranges: [{ start: 21501, end: 21700 }],
      rangeCount: 200,
      quantity: 200,
      status: "claimable",
      expiryDate: "2026-05-02",
      mintDate: "2025-03-22",
      termDays: 406,
    },
    {
      id: 2,
      sheet: "X7-8f39",
      rowNumber: 37,
      wallet: "0x1111111111111111111111111111111111111111",
      label: "35001-35100",
      ranges: [{ start: 35001, end: 35100 }],
      rangeCount: 100,
      quantity: 100,
      status: "planned_mint",
      expiryDate: null,
      mintDate: null,
      termDays: null,
    },
  ]);

  assert.deepEqual(
    items.map((item) => [item.kind, item.ids.length]),
    [
      ["claim_remint", 100],
      ["claim_remint", 100],
      ["planned_mint", 50],
      ["planned_mint", 50],
    ],
  );
});
