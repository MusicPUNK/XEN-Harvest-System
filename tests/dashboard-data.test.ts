import test from "node:test";
import assert from "node:assert/strict";

import { buildDashboardData } from "../src/dashboard-data.ts";
import { buildCoinToolHistoryIndex } from "../src/tx-history.ts";
import { buildClaimRemintCalldata } from "../src/template.ts";
import type { WorkbookRow } from "../src/models.ts";

const wallet = "0x2222222222222222222222222222222222222222";

test("builds read-only dashboard summary and queue totals from workbook rows", () => {
  const rows: WorkbookRow[] = [
    row({ sheet: "X3-e599", rowNumber: 2, label: "1-80", expiryRaw: 260504, quantityRaw: 80 }),
    row({ sheet: "X3-e599", rowNumber: 3, label: "81-160", expiryRaw: 260506, quantityRaw: 80 }),
    row({ sheet: "X7-8f39", rowNumber: 37, label: "35001-35160", expiryRaw: null, mintDateRaw: null, termDaysRaw: null, quantityRaw: 160 }),
    row({ sheet: "X1-f9cf(old)", rowNumber: 2, label: "常规铸造", expiryRaw: 260504, quantityRaw: 1200 }),
  ];

  const dashboard = buildDashboardData(rows, {
    today: "2026-05-04",
    dueSoonDays: 7,
    maxBatchSize: 80,
    sourcePath: "/tmp/xen.xlsx",
    generatedAt: "2026-05-04T08:00:00.000Z",
  });

  assert.equal(dashboard.summary.claimable, 80);
  assert.equal(dashboard.summary.activeMint, 80);
  assert.equal(dashboard.summary.plannedMint, 160);
  assert.equal(dashboard.summary.needsReview, 0);
  assert.equal(dashboard.summary.queuedClaimRemint, 80);
  assert.equal(dashboard.summary.queuedPlannedMint, 160);
  assert.equal(dashboard.summary.queueChunks, 5);
  assert.equal(dashboard.dueSoon.length, 1);
  assert.equal(dashboard.dueSoon[0].label, "81-160");
  assert.equal(dashboard.dueSoon[0].daysUntilExpiry, 2);
  assert.equal(dashboard.allMint.length, 2);
  assert.deepEqual(dashboard.allMint.map((item) => item.label), ["1-80", "81-160"]);
  assert.equal(dashboard.wallets.length, 2);
  assert.equal(dashboard.wallets.find((item) => item.sheet === "X7-8f39")?.queuedPlannedMint, 160);
});

test("exposes planned mint expiry choices with derived term days", () => {
  const dashboard = buildDashboardData(
    [
      row({
        sheet: "X7-8f39",
        wallet: "0x1111111111111111111111111111111111111111",
        rowNumber: 37,
        label: "35001-36000",
        mintDateRaw: null,
        termDaysRaw: null,
        expiryRaw: 270704,
        quantityRaw: 1000,
      }),
    ],
    {
      today: "2026-05-05",
    },
  );

  assert.equal(dashboard.plannedMint.length, 1);
  assert.equal(dashboard.plannedMint[0].expiryDate, "2027-07-04");
  assert.equal(dashboard.plannedMint[0].termDays, 425);
});

test("exposes the current XEN max mint term in dashboard metadata", () => {
  const defaultDashboard = buildDashboardData([], {
    today: "2026-05-13",
  });
  const customDashboard = buildDashboardData([], {
    today: "2026-05-13",
    maxMintTermDays: 488,
  });

  assert.equal(defaultDashboard.metadata.maxMintTermDays, 488);
  assert.equal(customDashboard.metadata.maxMintTermDays, 488);
});

test("compares CoinTool chain count against unique non-planned proxy ids", () => {
  const dashboard = buildDashboardData(
    [
      row({ rowNumber: 2, label: "1-100", claimAmountRaw: 123 }),
      row({ rowNumber: 3, label: "F 1-100" }),
      row({ rowNumber: 4, label: "101-120" }),
      row({
        sheet: "X7-8f39",
        rowNumber: 5,
        wallet: "0x1111111111111111111111111111111111111111",
        label: "121-200",
        mintDateRaw: null,
        termDaysRaw: null,
        expiryRaw: null,
      }),
    ],
    {
      today: "2026-05-04",
      chainMintCounts: [
        {
          wallet,
          saltHex: "0x01",
          count: 120,
          status: "ok",
          checkedAt: "2026-05-04T12:00:00.000Z",
        },
      ],
    },
  );

  const x3 = dashboard.wallets.find((item) => item.sheet === "X3-e599");
  assert.equal(x3?.sheetMintedIds, 120);
  assert.equal(x3?.chainMinted, 120);
  assert.equal(x3?.chainDelta, 0);
  assert.equal(dashboard.summary.chainMismatchedWallets, 0);
});

test("adds read-only manual action suggestions per wallet", () => {
  const dashboard = buildDashboardData(
    [
      row({ rowNumber: 2, label: "1-120", expiryRaw: 260504 }),
      row({
        sheet: "X7-8f39",
        wallet: "0x1111111111111111111111111111111111111111",
        rowNumber: 3,
        label: "35001-35160",
        mintDateRaw: null,
        termDaysRaw: null,
        expiryRaw: null,
      }),
    ],
    {
      today: "2026-05-05",
      maxBatchSize: 80,
    },
  );

  const x3 = dashboard.wallets.find((item) => item.sheet === "X3-e599");
  assert.equal(x3?.manualActions.mint.count, 0);
  assert.equal(x3?.manualActions.claim.count, 100);
  assert.equal(x3?.manualActions.claimRemint.count, 100);
  assert.equal(x3?.manualActions.claimRemint.defaultTermDays, 469);
  assert.equal(x3?.manualActions.claimRemint.idStart, 1);
  assert.equal(x3?.manualActions.claimRemint.idEnd, 100);
  assert.deepEqual(x3?.manualActions.claimRemint.idRanges, ["1-100"]);

  const x7 = dashboard.wallets.find((item) => item.sheet === "X7-8f39");
  assert.equal(x7?.manualActions.mint.count, 50);
  assert.equal(x7?.manualActions.mint.idStart, 35001);
  assert.equal(x7?.manualActions.mint.idEnd, 35050);
  assert.equal(x7?.manualActions.claim.count, 0);
  assert.equal(x7?.manualActions.claimRemint.count, 0);
});

test("uses chain maturity timestamps for claimable and due-soon lists", () => {
  const dashboard = buildDashboardData(
    [
      row({ rowNumber: 48, label: "22001-22500", expiryRaw: 260509, quantityRaw: 500 }),
      row({ rowNumber: 49, label: "22501-23000", expiryRaw: 260516, quantityRaw: 500 }),
    ],
    {
      today: "2026-05-09",
      dueSoonDays: 14,
      claimBatchSize: 100,
      nowTs: 1_778_314_000,
      chainMintStatuses: [
        {
          sheet: "X3-e599",
          rowNumber: 48,
          wallet,
          idStart: 22001,
          idEnd: 22100,
          proxyAddress: "0x0000000000000000000000000000000000000001",
          checkedAt: "2026-05-09T03:35:51.000Z",
          status: "active",
          term: 413,
          maturityTs: 1_778_314_631,
          unlockTime: "2026-05-09T08:17:11.000Z",
          rank: 30_914_510,
        },
        {
          sheet: "X3-e599",
          rowNumber: 48,
          wallet,
          idStart: 22101,
          idEnd: 22200,
          proxyAddress: "0x0000000000000000000000000000000000000002",
          checkedAt: "2026-05-09T03:35:51.000Z",
          status: "claimable",
          term: 413,
          maturityTs: 1_778_313_000,
          unlockTime: "2026-05-09T07:50:00.000Z",
          rank: 30_914_610,
        },
      ],
    },
  );

  assert.equal(dashboard.summary.claimable, 100);
  assert.equal(dashboard.claimable.length, 1);
  assert.equal(dashboard.claimable[0].label, "22101-22200");
  assert.equal(dashboard.claimable[0].unlockTime, "2026-05-09T07:50:00.000Z");
  assert.equal(dashboard.dueSoon.length, 1);
  assert.equal(dashboard.dueSoon[0].label, "22001-22100");
  assert.equal(dashboard.dueSoon[0].unlockTime, "2026-05-09T08:17:11.000Z");
  assert.equal(dashboard.allMint.length, 2);
  assert.deepEqual(new Set(dashboard.allMint.map((item) => item.status)), new Set(["claimable", "active_mint"]));
  const x3 = dashboard.wallets.find((item) => item.sheet === "X3-e599");
  assert.equal(x3?.manualActions.claimRemint.count, 100);
  assert.deepEqual(x3?.manualActions.claimRemint.idRanges, ["22101-22200"]);
});

test("keeps claimed or empty chain ranges in all-mint display rows", () => {
  const dashboard = buildDashboardData(
    [],
    {
      today: "2026-05-17",
      nowTs: 1_779_000_000,
      chainMintStatuses: [
        claimableStatus({ rowNumber: 1, idStart: 1, idEnd: 100, status: "claimed_or_empty", unlockTime: null, maturityTs: null, rank: null }),
        claimableStatus({ rowNumber: 101, idStart: 101, idEnd: 200 }),
      ],
    },
  );

  assert.deepEqual(dashboard.allMint.map((item) => item.label), ["1-100", "101-200"]);
  assert.equal(dashboard.allMint[0].status, "active_mint");
  assert.equal(dashboard.claimable.length, 1);
  assert.equal(dashboard.claimable[0].label, "101-200");
});

test("marks table remint round mismatches against CoinTool F transaction history", () => {
  const dashboard = buildDashboardData(
    [
      row({ rowNumber: 48, label: "F 1-100", expiryRaw: 260509, quantityRaw: 100 }),
      row({ rowNumber: 49, label: "FF 101-125", expiryRaw: 260509, quantityRaw: 25 }),
    ],
    {
      today: "2026-05-09",
      nowTs: 1_778_314_000,
      chainHistory: buildCoinToolHistoryIndex([
        {
          hash: "0x1",
          from: wallet,
          blockNumber: 1,
          transactionIndex: 0,
          input: buildClaimRemintCalldata({
            ids: rangeIds(1, 100),
            wallet,
            termDays: 469,
            target: "0xc7ba94123464105a42f0f6c4093f0b16a5ce5c98",
            innerSelector: "0x68154343",
            saltHex: "0x01",
          }),
        },
        {
          hash: "0x2",
          from: wallet,
          blockNumber: 2,
          transactionIndex: 0,
          input: buildClaimRemintCalldata({
            ids: rangeIds(101, 125),
            wallet,
            termDays: 469,
            target: "0xc7ba94123464105a42f0f6c4093f0b16a5ce5c98",
            innerSelector: "0x68154343",
            saltHex: "0x01",
          }),
        },
      ]),
      chainMintStatuses: [
        claimableStatus({ rowNumber: 48, idStart: 1, idEnd: 100, label: "F 1-100", baseLabel: "1-100", remintRound: 1 }),
        claimableStatus({ rowNumber: 49, idStart: 101, idEnd: 125, label: "FF 101-125", baseLabel: "101-125", remintRound: 2 }),
      ],
    },
  );

  assert.equal(dashboard.claimable[0].tableRemintRound, 1);
  assert.equal(dashboard.claimable[0].chainRemintRound, 1);
  assert.equal(dashboard.claimable[0].remintRoundMismatch, false);
  assert.equal(dashboard.claimable[1].tableRemintRound, 2);
  assert.equal(dashboard.claimable[1].chainRemintRound, 1);
  assert.equal(dashboard.claimable[1].remintRoundMismatch, true);
});

test("sorts wallets by chain next unlock time and stores next unlock quantity", () => {
  const dashboard = buildDashboardData(
    [
      row({ sheet: "X1-f9cf", wallet: "0xc40d00000000000000000000000000000000f9cf", rowNumber: 2, label: "1-100", expiryRaw: 260520 }),
      row({ sheet: "X2-ca95", wallet: "0xab9b00000000000000000000000000000000ca95", rowNumber: 3, label: "1-100", expiryRaw: 260513 }),
      row({ sheet: "X3-e599", wallet, rowNumber: 4, label: "1-100", expiryRaw: 260517 }),
    ],
    {
      today: "2026-05-13",
      nowTs: 1_778_688_000,
      chainMintStatuses: [
        chainStatus({ sheet: "X1-f9cf", wallet: "0xc40d00000000000000000000000000000000f9cf", rowNumber: 2, idStart: 1, idEnd: 100, unlockTime: "2026-05-20T10:00:00.000Z" }),
        chainStatus({ sheet: "X3-e599", wallet, rowNumber: 4, idStart: 1, idEnd: 100, unlockTime: "2026-05-17T13:14:00.000Z" }),
        chainStatus({ sheet: "X2-ca95", wallet: "0xab9b00000000000000000000000000000000ca95", rowNumber: 3, idStart: 1, idEnd: 100, unlockTime: "2026-05-13T08:00:00.000Z" }),
        chainStatus({ sheet: "X2-ca95", wallet: "0xab9b00000000000000000000000000000000ca95", rowNumber: 3, idStart: 101, idEnd: 200, unlockTime: "2026-05-13T08:00:00.000Z" }),
        chainStatus({ sheet: "X2-ca95", wallet: "0xab9b00000000000000000000000000000000ca95", rowNumber: 3, idStart: 201, idEnd: 300, unlockTime: "2026-05-13T15:00:00.000Z" }),
      ],
    },
  );

  assert.deepEqual(dashboard.wallets.map((item) => item.sheet), ["X2-ca95", "X3-e599", "X1-f9cf"]);
  assert.equal(dashboard.wallets[0].nextUnlockTime, "2026-05-13T08:00:00.000Z");
  assert.equal(dashboard.wallets[0].nextUnlockQuantity, 300);
  assert.equal(dashboard.wallets[1].nextUnlockTime, "2026-05-17T13:14:00.000Z");
});

function row(overrides: Partial<WorkbookRow>): WorkbookRow {
  return {
    sheet: "X3-e599",
    rowNumber: 1,
    wallet,
    label: "1-1",
    mintDateRaw: 250101,
    termDaysRaw: 365,
    expiryRaw: 260101,
    quantityRaw: 1,
    claimAmountRaw: null,
    ...overrides,
  };
}

function chainStatus(overrides: {
  sheet: string;
  wallet: string;
  rowNumber: number;
  idStart: number;
  idEnd: number;
  unlockTime: string;
}) {
  return {
    sheet: overrides.sheet,
    rowNumber: overrides.rowNumber,
    wallet: overrides.wallet,
    idStart: overrides.idStart,
    idEnd: overrides.idEnd,
    proxyAddress: "0x0000000000000000000000000000000000000001",
    checkedAt: "2026-05-13T00:00:00.000Z",
    status: "active" as const,
    term: 469,
    maturityTs: Math.floor(Date.parse(overrides.unlockTime) / 1000),
    unlockTime: overrides.unlockTime,
    rank: 1,
  };
}

function claimableStatus(overrides: Partial<ReturnType<typeof chainStatus>>) {
  return {
    ...chainStatus({
      sheet: "X3-e599",
      wallet,
      rowNumber: 1,
      idStart: 1,
      idEnd: 100,
      unlockTime: "2026-05-09T08:00:00.000Z",
    }),
    status: "claimable" as const,
    ...overrides,
  };
}

function rangeIds(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
