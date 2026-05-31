import test from "node:test";
import assert from "node:assert/strict";

import { classifyWorkbookRows } from "../src/importer.ts";

const wallet = "0x2222222222222222222222222222222222222222";

test("classifies X3 due unclaimed rows as claimable", () => {
  const result = classifyWorkbookRows(
    [
      {
        sheet: "X3-e599",
        rowNumber: 47,
        wallet,
        label: "21501-22000",
        mintDateRaw: 250322,
        termDaysRaw: 406,
        expiryRaw: 260502,
        quantityRaw: 500,
        claimAmountRaw: null,
      },
    ],
    { today: "2026-05-03" },
  );

  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].status, "claimable");
  assert.equal(result.records[0].rangeCount, 500);
  assert.equal(result.needsReview.length, 0);
});

test("classifies X7 blank future rows as planned mint, not missing expiry", () => {
  const result = classifyWorkbookRows(
    [
      {
        sheet: "X7-8f39",
        rowNumber: 37,
        wallet: "0x1111111111111111111111111111111111111111",
        label: "35001-36000",
        mintDateRaw: null,
        termDaysRaw: null,
        expiryRaw: null,
        quantityRaw: 1000,
        claimAmountRaw: null,
      },
    ],
    { today: "2026-05-03" },
  );

  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].status, "planned_mint");
  assert.equal(result.records[0].rangeCount, 1000);
  assert.equal(result.needsReview.length, 0);
});

test("classifies X8 pre-scheduled rows without mint details as planned mint", () => {
  const result = classifyWorkbookRows(
    [
      {
        sheet: "X8-3b8a",
        rowNumber: 2,
        wallet: "0x0000000000000000000000000000000000003b8a",
        label: "1-1000",
        mintDateRaw: null,
        termDaysRaw: null,
        expiryRaw: 270725,
        quantityRaw: null,
        claimAmountRaw: null,
      },
    ],
    { today: "2026-05-05" },
  );

  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].status, "planned_mint");
  assert.equal(result.records[0].rangeCount, 1000);
  assert.equal(result.needsReview.length, 0);
});

test("uses proxy id range count as quantity when the recorded quantity differs", () => {
  const result = classifyWorkbookRows(
    [
      {
        sheet: "X5-694c",
        rowNumber: 17,
        wallet: "0x4444444444444444444444444444444444444444",
        label: "15000-16000",
        mintDateRaw: 250706,
        termDaysRaw: 357,
        expiryRaw: 260719,
        quantityRaw: 1000,
        claimAmountRaw: null,
      },
    ],
    { today: "2026-05-03" },
  );

  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].quantity, 1001);
  assert.equal(result.records[0].rangeCount, 1001);
  assert.equal(result.records[0].status, "active_mint");
  assert.equal(result.needsReview.length, 0);
});

test("classifies future unclaimed rows as active mint", () => {
  const result = classifyWorkbookRows(
    [
      {
        sheet: "X5-694c",
        rowNumber: 2,
        wallet: "0x4444444444444444444444444444444444444444",
        label: "1-1000",
        mintDateRaw: 250706,
        termDaysRaw: 329,
        expiryRaw: 260531,
        quantityRaw: 1000,
        claimAmountRaw: null,
      },
    ],
    { today: "2026-05-03" },
  );

  assert.equal(result.records[0].status, "active_mint");
});

test("ignores already claimed legacy summary rows without proxy ranges", () => {
  const result = classifyWorkbookRows(
    [
      {
        sheet: "X1.1-f9cf",
        rowNumber: 2,
        wallet: "0x5555555555555555555555555555555555555555",
        label: "X1 old",
        mintDateRaw: 230610,
        termDaysRaw: 200,
        expiryRaw: 241005,
        quantityRaw: 24000,
        claimAmountRaw: 209577877520,
      },
    ],
    { today: "2026-05-03" },
  );

  assert.equal(result.records.length, 0);
  assert.equal(result.needsReview.length, 0);
});

test("ignores old and analysis sheets that are not executable proxy-id records", () => {
  const result = classifyWorkbookRows(
    [
      {
        sheet: "X1-f9cf(old)",
        rowNumber: 2,
        wallet: "0x5555555555555555555555555555555555555555",
        label: "常规铸造",
        mintDateRaw: 230610,
        termDaysRaw: 200,
        expiryRaw: 241005,
        quantityRaw: 1200,
        claimAmountRaw: null,
      },
      {
        sheet: "XEN成本分析",
        rowNumber: 2,
        wallet: "",
        label: "总成本",
        mintDateRaw: null,
        termDaysRaw: null,
        expiryRaw: null,
        quantityRaw: null,
        claimAmountRaw: null,
      },
    ],
    { today: "2026-05-03" },
  );

  assert.equal(result.records.length, 0);
  assert.equal(result.needsReview.length, 0);
});
