import test from "node:test";
import assert from "node:assert/strict";

import { buildClaimPreview, buildClaimRemintPreview, buildMintPreview } from "../src/action-preview.ts";
import { COINTOOL_BATCH_MINTER } from "../src/chain.ts";
import type { WorkbookRow } from "../src/models.ts";

test("builds the next planned mint transaction preview using a 50 id batch", () => {
  const preview = buildMintPreview(
    [
      row({
        sheet: "X7-8f39",
        wallet: "0x1111111111111111111111111111111111111111",
        rowNumber: 37,
        label: "35001-36000",
        expiryRaw: 270704,
      }),
    ],
    {
      sheet: "X7-8f39",
      today: "2026-05-05",
      plannedMintBatchSize: 50,
    },
  );

  assert.equal(preview.kind, "mint");
  assert.equal(preview.sheet, "X7-8f39");
  assert.equal(preview.wallet, "0x1111111111111111111111111111111111111111");
  assert.equal(preview.to, COINTOOL_BATCH_MINTER);
  assert.equal(preview.value, "0x0");
  assert.equal(preview.count, 50);
  assert.equal(preview.termDays, 425);
  assert.equal(preview.expiryDate, "2027-07-04");
  assert.equal(preview.ids[0], 35001);
  assert.equal(preview.ids.at(-1), 35050);
  assert.match(preview.data, /^0xb1ae2ed1/);
  assert.equal(preview.transactions[0].functionName, "mint");
  assert.equal(
    preview.transactions[0].operationId,
    "1:0x1111111111111111111111111111111111111111:0x0de8bf93da2f7eecb3d9169422413a9bef4ef628:mint:35001:35050:425:1",
  );
});

test("builds a multi-transaction planned mint preview from a manual plan count and term", () => {
  const preview = buildMintPreview(
    [
      row({
        sheet: "X7-8f39",
        wallet: "0x1111111111111111111111111111111111111111",
        rowNumber: 37,
        label: "35001-36000",
        expiryRaw: 270704,
      }),
    ],
    {
      sheet: "X7-8f39",
      today: "2026-05-05",
      plannedMintBatchSize: 50,
      plannedCount: 1000,
      termDays: 469,
    },
  );

  assert.equal(preview.count, 50);
  assert.equal(preview.plannedCount, 1000);
  assert.equal(preview.transactionCount, 20);
  assert.equal(preview.termDays, 469);
  assert.equal(preview.expiryDate, "2027-08-17");
  assert.equal(preview.idStart, 35001);
  assert.equal(preview.idEnd, 36000);
  assert.equal(preview.transactions.length, 20);
  assert.deepEqual(preview.transactions[0].ids, Array.from({ length: 50 }, (_, index) => 35001 + index));
  assert.equal(preview.transactions[0].count, 50);
  assert.equal(preview.transactions[19].ids[0], 35951);
  assert.equal(preview.transactions[19].ids.at(-1), 36000);
  assert.match(preview.transactions[0].data, /^0xb1ae2ed1/);
  assert.equal(preview.transactions[0].operationId, "1:0x1111111111111111111111111111111111111111:0x0de8bf93da2f7eecb3d9169422413a9bef4ef628:mint:35001:35050:469:1");
  assert.equal(preview.transactions[19].operationId, "1:0x1111111111111111111111111111111111111111:0x0de8bf93da2f7eecb3d9169422413a9bef4ef628:mint:35951:36000:469:20");
});

test("builds a manual mint preview from chain count without workbook planned rows", () => {
  const preview = buildMintPreview([], {
    sheet: "Connected",
    wallet: "0x1111111111111111111111111111111111111111",
    today: "2026-05-13",
    plannedMintBatchSize: 50,
    plannedCount: 120,
    termDays: 417,
    startId: 35851,
  });

  assert.equal(preview.sheet, "Connected");
  assert.equal(preview.wallet, "0x1111111111111111111111111111111111111111");
  assert.equal(preview.plannedCount, 120);
  assert.equal(preview.transactionCount, 3);
  assert.equal(preview.idStart, 35851);
  assert.equal(preview.idEnd, 35970);
  assert.equal(preview.termDays, 417);
  assert.equal(preview.expiryDate, "2027-07-04");
  assert.deepEqual(preview.transactions.map((tx) => [tx.idStart, tx.idEnd, tx.count]), [
    [35851, 35900, 50],
    [35901, 35950, 50],
    [35951, 35970, 20],
  ]);
});

test("skips planned mint ids that are already ahead on chain", () => {
  const preview = buildMintPreview(
    [
      row({
        sheet: "X7-8f39",
        wallet: "0x1111111111111111111111111111111111111111",
        rowNumber: 37,
        label: "35001-36000",
        expiryRaw: 270704,
      }),
    ],
    {
      sheet: "X7-8f39",
      today: "2026-05-09",
      plannedMintBatchSize: 50,
      plannedCount: 100,
      skipPlannedIds: 50,
      termDays: 421,
    },
  );

  assert.equal(preview.plannedCount, 100);
  assert.equal(preview.transactionCount, 2);
  assert.equal(preview.idStart, 35051);
  assert.equal(preview.idEnd, 35150);
  assert.deepEqual(preview.transactions.map((tx) => [tx.idStart, tx.idEnd, tx.count]), [
    [35051, 35100, 50],
    [35101, 35150, 50],
  ]);
});

test("builds claim+remint preview only from chain-claimable batches", () => {
  const preview = buildClaimRemintPreview(
    [
      chainStatus({ idStart: 22001, idEnd: 22100, status: "claimable" }),
      chainStatus({ idStart: 22101, idEnd: 22200, status: "claimable" }),
      chainStatus({ idStart: 22201, idEnd: 22300, status: "active" }),
    ],
    {
      sheet: "X3-e599",
      today: "2026-05-09",
      termDays: 469,
      claimBatchSize: 100,
    },
  );

  assert.equal(preview.kind, "claim_remint");
  assert.equal(preview.wallet, "0x2222222222222222222222222222222222222222");
  assert.equal(preview.count, 200);
  assert.equal(preview.transactionCount, 2);
  assert.equal(preview.idStart, 22001);
  assert.equal(preview.idEnd, 22200);
  assert.equal(preview.expiryDate, "2027-08-21");
  assert.deepEqual(preview.transactions.map((tx) => [tx.idStart, tx.idEnd, tx.count]), [
    [22001, 22100, 100],
    [22101, 22200, 100],
  ]);
  assert.match(preview.transactions[0].data, /^0xc2580804/);
  assert.equal(preview.transactions[0].functionName, "claim_remint");
  assert.equal(preview.transactions[0].expectedXenLogCount, 100);
  assert.equal(preview.transactions[0].operationId, "1:0x2222222222222222222222222222222222222222:0x0de8bf93da2f7eecb3d9169422413a9bef4ef628:claim_remint:22001:22100:469:1");
});

test("builds claim-only preview from selected chain-claimable batches", () => {
  const preview = buildClaimPreview(
    [
      chainStatus({ rowNumber: 10, idStart: 22001, idEnd: 22080, status: "claimable" }),
      chainStatus({ rowNumber: 11, idStart: 22081, idEnd: 22100, status: "claimable" }),
      chainStatus({ rowNumber: 12, idStart: 22101, idEnd: 22150, status: "active" }),
    ],
    {
      sheet: "X3-e599",
      today: "2026-05-09",
      claimBatchSize: 100,
      selectedBatches: [
        { rowNumber: 10, idStart: 22001, idEnd: 22080 },
        { rowNumber: 11, idStart: 22081, idEnd: 22100 },
      ],
    },
  );

  assert.equal(preview.kind, "claim");
  assert.equal(preview.wallet, "0x2222222222222222222222222222222222222222");
  assert.equal(preview.count, 100);
  assert.equal(preview.transactionCount, 1);
  assert.deepEqual(preview.transactions[0].idRanges, ["22001-22080", "22081-22100"]);
  assert.match(preview.transactions[0].data, /^0xc2580804/);
  assert.equal(preview.transactions[0].functionName, "claim");
  assert.equal(preview.transactions[0].expectedXenLogCount, 100);
  assert.equal(preview.transactions[0].operationId, "1:0x2222222222222222222222222222222222222222:0x0de8bf93da2f7eecb3d9169422413a9bef4ef628:claim:22001:22100:0:1");
});

test("builds claim+remint preview from selected batches and merges by quantity", () => {
  const preview = buildClaimRemintPreview(
    [
      chainStatus({ rowNumber: 10, idStart: 1, idEnd: 100, status: "claimable" }),
      chainStatus({ rowNumber: 11, idStart: 101, idEnd: 125, status: "claimable" }),
      chainStatus({ rowNumber: 12, idStart: 226, idEnd: 250, status: "claimable" }),
      chainStatus({ rowNumber: 13, idStart: 351, idEnd: 375, status: "claimable" }),
      chainStatus({ rowNumber: 14, idStart: 476, idEnd: 500, status: "claimable" }),
      chainStatus({ rowNumber: 15, idStart: 501, idEnd: 600, status: "claimable" }),
    ],
    {
      sheet: "X3-e599",
      today: "2026-05-09",
      termDays: 469,
      claimBatchSize: 100,
      selectedBatches: [
        { rowNumber: 11, idStart: 101, idEnd: 125 },
        { rowNumber: 12, idStart: 226, idEnd: 250 },
        { rowNumber: 13, idStart: 351, idEnd: 375 },
        { rowNumber: 14, idStart: 476, idEnd: 500 },
      ],
    },
  );

  assert.equal(preview.count, 100);
  assert.equal(preview.transactionCount, 1);
  assert.equal(preview.idStart, 101);
  assert.equal(preview.idEnd, 500);
  assert.deepEqual(preview.transactions[0].idRanges, ["101-125", "226-250", "351-375", "476-500"]);
  assert.deepEqual(preview.transactions[0].ids, [
    ...rangeIds(101, 125),
    ...rangeIds(226, 250),
    ...rangeIds(351, 375),
    ...rangeIds(476, 500),
  ]);
});

test("builds claim+remint preview using a custom merge size", () => {
  const preview = buildClaimRemintPreview(
    [
      chainStatus({ rowNumber: 10, idStart: 1, idEnd: 100, status: "claimable" }),
      chainStatus({ rowNumber: 11, idStart: 101, idEnd: 125, status: "claimable" }),
      chainStatus({ rowNumber: 12, idStart: 226, idEnd: 250, status: "claimable" }),
    ],
    {
      sheet: "X3-e599",
      today: "2026-05-09",
      termDays: 469,
      claimBatchSize: 150,
      selectedBatches: [
        { rowNumber: 10, idStart: 1, idEnd: 100 },
        { rowNumber: 11, idStart: 101, idEnd: 125 },
        { rowNumber: 12, idStart: 226, idEnd: 250 },
      ],
    },
  );

  assert.equal(preview.transactionCount, 1);
  assert.equal(preview.transactions[0].count, 150);
  assert.deepEqual(preview.transactions[0].idRanges, ["1-100", "101-125", "226-250"]);
});

test("combines many selected small batches into one transaction until submit limit", () => {
  const preview = buildClaimRemintPreview(
    [
      chainStatus({ rowNumber: 10, idStart: 1, idEnd: 1, status: "claimable" }),
      chainStatus({ rowNumber: 11, idStart: 2, idEnd: 2, status: "claimable" }),
      chainStatus({ rowNumber: 12, idStart: 3, idEnd: 3, status: "claimable" }),
      chainStatus({ rowNumber: 13, idStart: 4, idEnd: 4, status: "claimable" }),
    ],
    {
      sheet: "X3-e599",
      today: "2026-05-09",
      termDays: 469,
      claimBatchSize: 100,
      selectedBatches: [
        { rowNumber: 10, idStart: 1, idEnd: 1 },
        { rowNumber: 11, idStart: 2, idEnd: 2 },
        { rowNumber: 12, idStart: 3, idEnd: 3 },
        { rowNumber: 13, idStart: 4, idEnd: 4 },
      ],
    },
  );

  assert.equal(preview.transactionCount, 1);
  assert.equal(preview.transactions[0].count, 4);
  assert.deepEqual(preview.transactions[0].idRanges, ["1", "2", "3", "4"]);
});

test("splits selected batches only after the submit limit is exceeded", () => {
  const preview = buildClaimRemintPreview(
    [
      chainStatus({ rowNumber: 10, idStart: 22401, idEnd: 22480, status: "claimable" }),
      chainStatus({ rowNumber: 11, idStart: 22481, idEnd: 22500, status: "claimable" }),
    ],
    {
      sheet: "X3-e599",
      today: "2026-05-09",
      termDays: 469,
      claimBatchSize: 80,
      selectedBatches: [
        { rowNumber: 10, idStart: 22401, idEnd: 22480 },
        { rowNumber: 11, idStart: 22481, idEnd: 22500 },
      ],
    },
  );

  assert.equal(preview.transactionCount, 2);
  assert.deepEqual(preview.transactions.map((tx) => [tx.idStart, tx.idEnd, tx.count]), [
    [22401, 22480, 80],
    [22481, 22500, 20],
  ]);
});

test("splits selected claim+remint ranges into exact group sizes", () => {
  const preview = buildClaimRemintPreview(
    [
      chainStatus({ rowNumber: 10, idStart: 1, idEnd: 100, status: "claimable" }),
      chainStatus({ rowNumber: 11, idStart: 101, idEnd: 125, status: "claimable" }),
      chainStatus({ rowNumber: 12, idStart: 126, idEnd: 225, status: "claimable" }),
      chainStatus({ rowNumber: 13, idStart: 226, idEnd: 250, status: "claimable" }),
      chainStatus({ rowNumber: 14, idStart: 251, idEnd: 350, status: "claimable" }),
      chainStatus({ rowNumber: 15, idStart: 351, idEnd: 600, status: "claimable" }),
    ],
    {
      sheet: "X3-e599",
      today: "2026-05-09",
      termDays: 469,
      claimBatchSize: 300,
      selectedBatches: [
        { rowNumber: 10, idStart: 1, idEnd: 100 },
        { rowNumber: 11, idStart: 101, idEnd: 125 },
        { rowNumber: 12, idStart: 126, idEnd: 225 },
        { rowNumber: 13, idStart: 226, idEnd: 250 },
        { rowNumber: 14, idStart: 251, idEnd: 350 },
        { rowNumber: 15, idStart: 351, idEnd: 600 },
      ],
    },
  );

  assert.equal(preview.transactionCount, 2);
  assert.deepEqual(preview.transactions.map((tx) => [tx.idStart, tx.idEnd, tx.count]), [
    [1, 300, 300],
    [301, 600, 300],
  ]);
  assert.deepEqual(preview.transactions[0].idRanges, ["1-100", "101-125", "126-225", "226-250", "251-300"]);
  assert.deepEqual(preview.transactions[1].idRanges, ["301-350", "351-600"]);
});

function row(overrides: Partial<WorkbookRow>): WorkbookRow {
  return {
    sheet: "X7-8f39",
    rowNumber: 1,
    wallet: "0x1111111111111111111111111111111111111111",
    label: "1-1",
    mintDateRaw: null,
    termDaysRaw: null,
    expiryRaw: null,
    quantityRaw: null,
    claimAmountRaw: null,
    ...overrides,
  };
}

function chainStatus(overrides: Partial<Parameters<typeof buildClaimRemintPreview>[0][number]>) {
  return {
    sheet: "X3-e599",
    rowNumber: 48,
    wallet: "0x2222222222222222222222222222222222222222",
    idStart: 22001,
    idEnd: 22100,
    proxyAddress: "0x0000000000000000000000000000000000000001",
    checkedAt: "2026-05-09T08:30:00.000Z",
    status: "claimable" as const,
    term: 413,
    maturityTs: 1_778_314_631,
    unlockTime: "2026-05-09T08:17:11.000Z",
    rank: 30_914_510,
    ...overrides,
  };
}

function rangeIds(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
