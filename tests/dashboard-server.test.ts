import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_CHAIN_STATUS_TIMEOUT_MS,
  buildClaimPreviewResponse,
  buildClaimRemintPreviewResponse,
  buildDashboardResponse,
  buildMintPreviewResponse,
  readDashboardAsset,
} from "../src/dashboard-server.ts";
import type { WorkbookRow } from "../src/models.ts";
import { buildClaimRemintCalldata, buildMintCalldata } from "../src/template.ts";

function historyTx(overrides: {
  blockNumber: number;
  transactionIndex: number;
  wallet: string;
  input: string;
}) {
  return {
    hash: `0x${String(overrides.blockNumber).padStart(64, "0")}`,
    from: overrides.wallet,
    input: overrides.input,
    blockNumber: overrides.blockNumber,
    transactionIndex: overrides.transactionIndex,
  };
}

function rangeIds(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

test("default chain maturity timeout supports multi-wallet public refresh", () => {
  assert.ok(DEFAULT_CHAIN_STATUS_TIMEOUT_MS >= 180_000);
});

test("builds read-only dashboard api payload and static shell", async () => {
  const rows: WorkbookRow[] = [
    {
      sheet: "X7-8f39",
      rowNumber: 37,
      wallet: "0x1111111111111111111111111111111111111111",
      label: "35001-35080",
      mintDateRaw: null,
      termDaysRaw: null,
      expiryRaw: null,
      quantityRaw: 80,
      claimAmountRaw: null,
    },
  ];
  const dashboard = await buildDashboardResponse({
    today: "2026-05-04",
    generatedAt: "2026-05-04T09:00:00.000Z",
    readRows: () => rows,
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
  });

  assert.equal(dashboard.data.summary.plannedMint, 80);
  assert.equal(dashboard.data.summary.queuedPlannedMint, 80);
  assert.equal(dashboard.data.metadata.readOnly, true);
  assert.equal(dashboard.gas.snapshot.source, "unavailable");

  const html = await readDashboardAsset("/");
  assert.equal(html.contentType, "text/html; charset=utf-8");
  assert.match(html.text, /XEN 一键收菜系统/);
  assert.match(html.text, /rocket-badge/);
  assert.match(html.text, /<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg" \/>/);
  assert.match(html.text, /scrollTopButton/);
  assert.doesNotMatch(html.text, /XEN \/ CoinTool/);
  assert.doesNotMatch(html.text, /XEN \/ CoinTool Console/);
  assert.match(html.text, /连接钱包/);
  assert.doesNotMatch(html.text, /钱包确认后发交易/);
  assert.doesNotMatch(html.text, /operationModal/);
  assert.doesNotMatch(html.text, /actionReminderList/);
  assert.doesNotMatch(html.text, /annotationModeButton/);
  assert.doesNotMatch(html.text, /annotationPanel/);
  assert.doesNotMatch(html.text, /批注模式/);
  assert.doesNotMatch(html.text, /myWalletSection/);
  assert.doesNotMatch(html.text, /walletMonitorStrip/);
  assert.doesNotMatch(html.text, /我的钱包/);
  assert.match(html.text, /钱包管理/);
  assert.doesNotMatch(html.text, /钱包状态/);
  assert.doesNotMatch(html.text, /walletSpreadActions/);
  assert.match(html.text, /addWalletButton/);
  assert.match(html.text, /deleteWalletButton/);
  assert.match(html.text, /aria-label="增加监控钱包"/);
  assert.match(html.text, /aria-label="删除监控钱包"/);
  assert.match(html.text, /consoleBatchSelector/);
  assert.match(html.text, /Group Merge/);
  assert.doesNotMatch(html.text, /consoleMergeRefreshButton/);
  assert.match(html.text, /Group Merge 数量/);
  assert.match(html.text, /单笔提交上限/);
  assert.match(html.text, /consoleSubmitLimitInput/);
  assert.doesNotMatch(html.text, /consoleGroupMergeCheckbox/);
  assert.match(html.text, /data-console-mode="claim"/);
  assert.match(html.text, /复投/);
  assert.match(html.text, /可收/);
  assert.match(html.text, /新种/);
  assert.match(html.text, /查看全部/);
  assert.doesNotMatch(html.text, /已连接钱包/);
  assert.doesNotMatch(html.text, /wallet-selected-readonly/);
  assert.doesNotMatch(html.text, /<select id="walletSelect"/);
  assert.doesNotMatch(html.text, /walletSpreadCount/);
  assert.doesNotMatch(html.text, /walletSpreadActionDrawer/);
  assert.doesNotMatch(html.text, /todayAlertBoard/);
  assert.doesNotMatch(html.text, /今日待收菜/);
  assert.ok(html.text.indexOf("wallet-spread-section") < html.text.indexOf("console-shell"));
  assert.match(html.text, /dashboard\.js\?v=/);

  const favicon = await readDashboardAsset("/favicon.svg");
  assert.equal(favicon.contentType, "image/svg+xml; charset=utf-8");
  assert.match(favicon.text, /<svg/);

  const script = await readDashboardAsset("/dashboard.js");
  assert.equal(script.contentType, "text/javascript; charset=utf-8");
  assert.doesNotMatch(script.text, /xenDashboardAnnotations/);
  assert.doesNotMatch(script.text, /renderAnnotations/);
  assert.doesNotMatch(script.text, /renderWalletSpreadActionDrawer/);
  assert.doesNotMatch(script.text, /renderWalletSpreadActions/);
  assert.doesNotMatch(script.text, /todayAlertBoard/);
  assert.doesNotMatch(script.text, /renderTodayAlert/);
  assert.doesNotMatch(script.text, /链上已种/);
  assert.match(script.text, /xenPublicMonitoredWallets/);
  assert.match(script.text, /xenMonitoredWallets/);
  assert.match(script.text, /walletDeleteMode/);
  assert.match(script.text, /delete-mode/);
  assert.doesNotMatch(script.text, /data-monitor-add/);
  assert.doesNotMatch(script.text, /wallet-spread-add/);
  assert.match(script.text, /claim-address-card/);
  assert.match(script.text, /syncConsoleMergeInput/);
  assert.doesNotMatch(script.text, /consoleMergeRefreshButton/);
  assert.match(script.text, /readConsoleSubmitLimit/);
  assert.match(script.text, /transactionGroupsForSelectedGroups/);
  assert.doesNotMatch(script.text, /consoleGroupMergeCheckbox/);
  assert.doesNotMatch(script.text, /单地址\/笔/);
  assert.match(script.text, /consoleMetricLabel\.textContent = "已种数量"/);
  assert.doesNotMatch(script.text, /consoleMetricLabel\.textContent = "只种"/);
  assert.match(script.text, /等待链上成熟后再执行，页面会自动刷新。/);
  assert.doesNotMatch(script.text, /等待链上成熟后再执行。页面会自动刷新。/);
});

test("dashboard metadata uses the dynamic XEN max mint term", async () => {
  const dashboard = await buildDashboardResponse({
    today: "2026-05-13",
    readRows: () => [],
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
    getChainCounts: async () => [],
    getMaxMintTermDays: async () => 505,
  });

  assert.equal(dashboard.data.metadata.maxMintTermDays, 505);
});

test("includes a connected wallet from chain even when no workbook row exists", async () => {
  const wallet = "0x1111111111111111111111111111111111118f39";
  const dashboard = await buildDashboardResponse({
    today: "2026-05-13",
    readRows: () => [],
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
    getChainCounts: async (wallets) => {
      assert.deepEqual(wallets, [wallet]);
      return [
        {
          wallet,
          saltHex: "0x01",
          count: 1234,
          status: "ok",
          checkedAt: "2026-05-13T06:00:00.000Z",
        },
      ];
    },
  }, { connectedWallet: wallet });

  assert.equal(dashboard.data.wallets.length, 1);
  assert.equal(dashboard.data.wallets[0].sheet, "0x11...8f39");
  assert.equal(dashboard.data.wallets[0].wallet, wallet);
  assert.equal(dashboard.data.wallets[0].chainMinted, 1234);
  assert.equal(dashboard.data.wallets[0].chainStatus, "ok");
  assert.equal(dashboard.data.summary.wallets, 1);
  assert.equal(dashboard.chain.checkedWallets, 1);
});

test("public mode does not read workbook rows and monitors submitted wallets", async () => {
  const wallet = "0x2222222222222222222222222222222222228f39";
  let readRowsCalled = false;
  const dashboard = await buildDashboardResponse({
    publicMode: true,
    today: "2026-05-16",
    readRows: () => {
      readRowsCalled = true;
      return [];
    },
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
    getChainCounts: async (wallets) => {
      assert.deepEqual(wallets, [wallet]);
      return [
        {
          wallet,
          saltHex: "0x01",
          count: 4321,
          status: "ok",
          checkedAt: "2026-05-16T06:00:00.000Z",
        },
      ];
    },
  }, { monitoredWallets: [{ name: "Test Wallet", wallet }] });

  assert.equal(readRowsCalled, false);
  assert.equal(dashboard.source.kind, "public");
  assert.equal(dashboard.source.localPath, null);
  assert.equal(dashboard.data.metadata.sourcePath, "public-chain");
  assert.equal(dashboard.data.wallets.length, 1);
  assert.equal(dashboard.data.wallets[0].sheet, "Test Wallet");
  assert.equal(dashboard.data.wallets[0].chainMinted, 4321);
  assert.equal(dashboard.data.summary.chainCheckedWallets, 1);
});

test("public mode derives chain maturity batches from monitored wallet minted count", async () => {
  const wallet = "0x3333333333333333333333333333333333338f39";
  const soonTs = Math.floor(Date.now() / 1000) + 60 * 60;
  const soonIso = new Date(soonTs * 1000).toISOString();
  const seenRanges: Array<[number, number]> = [];
  const dashboard = await buildDashboardResponse({
    publicMode: true,
    today: "2026-05-16",
    plannedMintBatchSize: 50,
    claimBatchSize: 100,
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
    getChainCounts: async () => [
      {
        wallet,
        saltHex: "0x01",
        count: 120,
        status: "ok",
        checkedAt: "2026-05-16T06:00:00.000Z",
      },
    ],
    getChainMintStatuses: async (candidates) => {
      seenRanges.push(...candidates.map((candidate) => [candidate.idStart, candidate.idEnd] as [number, number]));
      return candidates.map((candidate) => ({
        ...candidate,
        proxyAddress: `0x${String(candidate.idStart).padStart(40, "0")}`,
        checkedAt: "2026-05-16T06:00:01.000Z",
        status: candidate.idStart <= 100 ? "claimable" : "active",
        term: 469,
        maturityTs: candidate.idStart <= 100 ? 1715779200 : soonTs,
        unlockTime: candidate.idStart <= 100 ? "2024-05-15T16:00:00.000Z" : soonIso,
        rank: 1000 + candidate.idStart,
      }));
    },
  }, { monitoredWallets: [{ name: "Public X", wallet }] });

  assert.deepEqual(seenRanges, [[1, 50], [51, 100], [101, 120]]);
  assert.equal(dashboard.data.wallets.length, 1);
  assert.equal(dashboard.data.wallets[0].sheet, "Public X");
  assert.equal(dashboard.data.wallets[0].chainMinted, 120);
  assert.equal(dashboard.data.wallets[0].claimable, 100);
  assert.equal(dashboard.data.wallets[0].nextUnlockTime, "2024-05-15T16:00:00.000Z");
  assert.equal(dashboard.data.wallets[0].nextUnlockQuantity, 100);
  assert.equal(dashboard.data.claimable.length, 1);
  assert.equal(dashboard.data.dueSoon.length, 1);
});

test("public mode scans dashboard maturity in 50-id batches when no CoinTool history is available", async () => {
  const wallet = "0x222222222222222222222222222222222222ca95";
  const seenRanges: Array<[number, number]> = [];
  const laterIso = "2026-11-01T12:00:00.000Z";
  const soonIso = "2026-06-01T09:00:00.000Z";
  const dashboard = await buildDashboardResponse({
    publicMode: true,
    plannedMintBatchSize: 4,
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
    getChainCounts: async () => [
      {
        wallet,
        saltHex: "0x01",
        count: 4,
        status: "ok",
        checkedAt: "2026-05-16T06:00:00.000Z",
      },
    ],
    getChainMintStatuses: async (candidates) => {
      seenRanges.push(...candidates.map((candidate) => [candidate.idStart, candidate.idEnd] as [number, number]));
      return candidates.map((candidate) => ({
        ...candidate,
        proxyAddress: `0x${String(candidate.idStart).padStart(40, "0")}`,
        checkedAt: "2026-05-16T06:00:01.000Z",
        status: "active" as const,
        term: 469,
        maturityTs: candidate.idStart === 1 ? 1_780_298_400 : 1_793_529_600,
        unlockTime: candidate.idStart === 1 ? soonIso : laterIso,
        rank: 20_000,
      }));
    },
  }, { monitoredWallets: [{ name: "X2", wallet }] });

  assert.deepEqual(seenRanges, [[1, 4]]);
  assert.equal(dashboard.data.wallets[0].nextUnlockTime, soonIso);
  assert.equal(dashboard.data.wallets[0].nextUnlockQuantity, 4);
});

test("public mode chunks large no-history wallets for dashboard maturity display", async () => {
  const wallet = "0x222222222222222222222222222222222222ca95";
  const seenRanges: Array<[number, number]> = [];
  const soonIso = "2026-06-01T09:00:00.000Z";
  const laterIso = "2026-11-01T12:00:00.000Z";
  const dashboard = await buildDashboardResponse({
    publicMode: true,
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
    getChainCounts: async () => [
      {
        wallet,
        saltHex: "0x01",
        count: 120,
        status: "ok",
        checkedAt: "2026-05-16T06:00:00.000Z",
      },
    ],
    getChainMintStatuses: async (candidates) => {
      seenRanges.push(...candidates.map((candidate) => [candidate.idStart, candidate.idEnd] as [number, number]));
      return candidates.map((candidate) => ({
        ...candidate,
        proxyAddress: `0x${String(candidate.idStart).padStart(40, "0")}`,
        checkedAt: "2026-05-16T06:00:01.000Z",
        status: "active" as const,
        term: 469,
        maturityTs: candidate.idStart <= 50 ? 1_780_298_400 : 1_793_529_600,
        unlockTime: candidate.idStart <= 50 ? soonIso : laterIso,
        rank: 20_000,
      }));
    },
  }, { monitoredWallets: [{ name: "X2", wallet }] });

  assert.deepEqual(seenRanges, [[1, 50], [51, 100], [101, 120]]);
  assert.equal(dashboard.data.wallets[0].nextUnlockTime, soonIso);
  assert.equal(dashboard.data.wallets[0].nextUnlockQuantity, 50);
});

test("public mode keeps connected wallet ids visible when maturity reads time out", async () => {
  const wallet = "0x222222222222222222222222222222222222ca95";
  const dashboard = await buildDashboardResponse({
    publicMode: true,
    chainStatusTimeoutMs: 1,
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
    getChainCounts: async () => [
      {
        wallet,
        saltHex: "0x01",
        count: 250,
        status: "ok",
        checkedAt: "2026-05-16T06:00:00.000Z",
      },
    ],
    getChainMintStatuses: async () => new Promise(() => {}),
  }, { connectedWallet: wallet });

  assert.match(dashboard.chain.error ?? "", /Chain maturity reads timed out after 1ms/);
  assert.equal(dashboard.data.wallets.length, 1);
  assert.equal(dashboard.data.wallets[0].chainMinted, 250);
  assert.equal(dashboard.data.wallets[0].chainError, "Chain maturity reads timed out after 1ms");
  assert.deepEqual(dashboard.data.allMint.map((item) => [item.label, item.quantity, item.status]), [
    ["1-250", 250, "active_mint"],
  ]);
  assert.equal(dashboard.data.claimable.length, 0);
});

test("public mode keeps fast wallet maturity data when another wallet times out", async () => {
  const fastWallet = "0x222222222222222222222222222222222222ca95";
  const slowWallet = "0x333333333333333333333333333333333333e599";
  const soonIso = "2026-06-01T09:00:00.000Z";
  const dashboard = await buildDashboardResponse({
    publicMode: true,
    chainStatusTimeoutMs: 20,
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
    getChainCounts: async () => [
      {
        wallet: fastWallet,
        saltHex: "0x01",
        count: 50,
        status: "ok",
        checkedAt: "2026-05-16T06:00:00.000Z",
      },
      {
        wallet: slowWallet,
        saltHex: "0x01",
        count: 50,
        status: "ok",
        checkedAt: "2026-05-16T06:00:00.000Z",
      },
    ],
    getChainMintStatuses: async (candidates) => {
      if (candidates[0]?.wallet.toLowerCase() === slowWallet.toLowerCase()) {
        return new Promise(() => {});
      }
      return candidates.map((candidate) => ({
        ...candidate,
        proxyAddress: `0x${String(candidate.idStart).padStart(40, "0")}`,
        checkedAt: "2026-05-16T06:00:01.000Z",
        status: "active" as const,
        term: 469,
        maturityTs: 1_780_298_400,
        unlockTime: soonIso,
        rank: 20_000,
      }));
    },
  }, { monitoredWallets: [
    { name: "Fast", wallet: fastWallet },
    { name: "Slow", wallet: slowWallet },
  ] });

  const fast = dashboard.data.wallets.find((wallet) => wallet.sheet === "Fast");
  const slow = dashboard.data.wallets.find((wallet) => wallet.sheet === "Slow");
  assert.equal(fast?.nextUnlockTime, soonIso);
  assert.equal(fast?.chainError, null);
  assert.equal(slow?.chainMinted, 50);
  assert.equal(slow?.chainError, "Chain maturity reads timed out after 20ms");
  assert.match(dashboard.chain.error ?? "", /Chain maturity reads timed out after 20ms/);
});

test("public mode uses CoinTool history ranges instead of fixed chunks when available", async () => {
  const wallet = "0x222222222222222222222222222222222222ca95";
  const soonIso = "2026-06-01T09:00:00.000Z";
  const laterIso = "2026-07-01T09:00:00.000Z";
  const latestIso = "2026-08-01T09:00:00.000Z";
  const seenRanges: Array<[string | undefined, number, number, number | undefined]> = [];
  const dashboard = await buildDashboardResponse({
    publicMode: true,
    plannedMintBatchSize: 50,
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
    getCoinToolTransactions: async () => [
      historyTx({ blockNumber: 1, transactionIndex: 0, wallet, input: buildMintCalldata({ total: 100, termDays: 469, saltHex: "0x01" }) }),
      historyTx({ blockNumber: 2, transactionIndex: 0, wallet, input: buildClaimRemintCalldata({
        ids: rangeIds(1, 25),
        wallet,
        termDays: 469,
        target: "0xc7ba94123464105a42f0f6c4093f0b16a5ce5c98",
        innerSelector: "0x68154343",
        saltHex: "0x01",
      }) }),
      historyTx({ blockNumber: 3, transactionIndex: 0, wallet, input: buildClaimRemintCalldata({
        ids: rangeIds(1, 10),
        wallet,
        termDays: 469,
        target: "0xc7ba94123464105a42f0f6c4093f0b16a5ce5c98",
        innerSelector: "0x68154343",
        saltHex: "0x01",
      }) }),
    ],
    getChainCounts: async () => [
      {
        wallet,
        saltHex: "0x01",
        count: 100,
        status: "ok",
        checkedAt: "2026-05-16T06:00:00.000Z",
      },
    ],
    getChainMintStatuses: async (candidates) => {
      seenRanges.push(...candidates.map((candidate) => [candidate.label, candidate.idStart, candidate.idEnd, candidate.remintRound] as [string | undefined, number, number, number | undefined]));
      return candidates.map((candidate) => ({
        ...candidate,
        proxyAddress: `0x${String(candidate.idStart).padStart(40, "0")}`,
        checkedAt: "2026-05-16T06:00:01.000Z",
        status: "active" as const,
        term: 469,
        maturityTs: candidate.idStart === 11 ? 1_780_298_400 : candidate.idStart === 26 ? 1_782_890_400 : 1_785_568_400,
        unlockTime: candidate.idStart === 11 ? soonIso : candidate.idStart === 26 ? laterIso : latestIso,
        rank: 20_000,
      }));
    },
  }, { monitoredWallets: [{ name: "X2", wallet }] });

  assert.deepEqual(seenRanges, [
    ["FF 1-10", 1, 10, 2],
    ["F 11-25", 11, 25, 1],
    ["26-100", 26, 100, 0],
  ]);
  assert.equal(dashboard.data.wallets[0].nextUnlockTime, soonIso);
  assert.equal(dashboard.data.wallets[0].nextUnlockQuantity, 15);
});

test("monitored wallets derive chain maturity batches outside public mode", async () => {
  const wallet = "0x333333333333333333333333333333333333d0a9";
  const soonTs = Math.floor(Date.now() / 1000) + 2 * 60 * 60;
  const soonIso = new Date(soonTs * 1000).toISOString();
  const dashboard = await buildDashboardResponse({
    today: "2026-05-16",
    plannedMintBatchSize: 50,
    claimBatchSize: 100,
    readRows: () => [],
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
    getChainCounts: async () => [
      {
        wallet,
        saltHex: "0x01",
        count: 120,
        status: "ok",
        checkedAt: "2026-05-16T06:00:00.000Z",
      },
    ],
    getChainMintStatuses: async (candidates) => {
      assert.equal(candidates.length, 3);
      assert.deepEqual(candidates.slice(0, 3).map((candidate) => [candidate.sheet, candidate.idStart, candidate.idEnd]), [
        ["X8", 1, 50],
        ["X8", 51, 100],
        ["X8", 101, 120],
      ]);
      return candidates.map((candidate) => ({
        ...candidate,
        proxyAddress: `0x${String(candidate.idStart).padStart(40, "0")}`,
        checkedAt: "2026-05-16T06:00:01.000Z",
        status: "active",
        term: 469,
        maturityTs: soonTs,
        unlockTime: soonIso,
        rank: 1000 + candidate.idStart,
      }));
    },
  }, { monitoredWallets: [{ name: "X8", wallet }] });

  assert.equal(dashboard.data.wallets.length, 1);
  assert.equal(dashboard.data.wallets[0].sheet, "X8");
  assert.equal(dashboard.data.wallets[0].chainMinted, 120);
  assert.equal(dashboard.data.wallets[0].nextUnlockTime, soonIso);
  assert.equal(dashboard.data.wallets[0].nextUnlockQuantity, 120);
  assert.equal(dashboard.data.dueSoon.length, 1);
});

test("includes read-only CoinTool chain count checks in wallet rows", async () => {
  const wallet = "0x3333333333333333333333333333333333333333";
  const dashboard = await buildDashboardResponse({
    today: "2026-05-04",
    readRows: () => [
      {
        sheet: "X1.4-87a8",
        rowNumber: 1,
        wallet,
        label: "1-50960",
        mintDateRaw: 260101,
        termDaysRaw: 367,
        expiryRaw: 270103,
        quantityRaw: 50960,
        claimAmountRaw: null,
      },
    ],
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
    getChainCounts: async (wallets) => {
      assert.deepEqual(wallets, [wallet]);
      return [
        {
          wallet,
          saltHex: "0x01",
          count: 51000,
          status: "ok",
          checkedAt: "2026-05-04T12:30:00.000Z",
        },
      ];
    },
  });

  assert.equal(dashboard.chain.enabled, true);
  assert.equal(dashboard.chain.checkedWallets, 1);
  assert.equal(dashboard.chain.mismatchedWallets, 1);
  assert.equal(dashboard.data.summary.chainMismatchedWallets, 1);
  assert.equal(dashboard.data.wallets[0].chainMinted, 51000);
  assert.equal(dashboard.data.wallets[0].chainDelta, 40);
  assert.equal(dashboard.data.wallets[0].chainStatus, "ok");
});

test("builds a planned mint transaction preview response", async () => {
  const preview = await buildMintPreviewResponse({
    today: "2026-05-05",
    plannedMintBatchSize: 50,
    readRows: () => [
      {
        sheet: "X7-8f39",
        rowNumber: 37,
        wallet: "0x1111111111111111111111111111111111111111",
        label: "35001-36000",
        mintDateRaw: null,
        termDaysRaw: null,
        expiryRaw: 270704,
        quantityRaw: 1000,
        claimAmountRaw: null,
      },
    ],
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
  }, { sheet: "X7-8f39", plannedCount: 1000, termDays: 469 });

  assert.equal(preview.sheet, "X7-8f39");
  assert.equal(preview.count, 50);
  assert.equal(preview.plannedCount, 1000);
  assert.equal(preview.transactionCount, 20);
  assert.equal(preview.termDays, 469);
  assert.equal(preview.ids[0], 35001);
  assert.equal(preview.ids.at(-1), 36000);
  assert.match(preview.data, /^0xb1ae2ed1/);
});

test("checks chain maturity for active rows beyond the due-soon window", async () => {
  let candidates: Array<{ sheet: string; idStart: number; idEnd: number }> = [];
  await buildDashboardResponse({
    today: "2026-05-13",
    dueSoonDays: 7,
    readRows: () => [
      {
        sheet: "X1-f9cf",
        rowNumber: 2,
        wallet: "0xc40d00000000000000000000000000000000f9cf",
        label: "1-100",
        mintDateRaw: 250101,
        termDaysRaw: 546,
        expiryRaw: 260701,
        quantityRaw: 100,
        claimAmountRaw: null,
      },
    ],
    getChainCounts: async () => [],
    getChainMintStatuses: async (items) => {
      candidates = items.map((item) => ({ sheet: item.sheet, idStart: item.idStart, idEnd: item.idEnd }));
      return [];
    },
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
  });

  assert.deepEqual(candidates, [{ sheet: "X1-f9cf", idStart: 1, idEnd: 100 }]);
});

test("does not block the dashboard when chain maturity reads are slow", async () => {
  const dashboard = await buildDashboardResponse({
    today: "2026-05-13",
    chainStatusTimeoutMs: 1,
    readRows: () => [
      {
        sheet: "X1-f9cf",
        rowNumber: 2,
        wallet: "0xc40d00000000000000000000000000000000f9cf",
        label: "1-100",
        mintDateRaw: 250101,
        termDaysRaw: 546,
        expiryRaw: 260701,
        quantityRaw: 100,
        claimAmountRaw: null,
      },
    ],
    getChainCounts: async () => [],
    getChainMintStatuses: async () => new Promise(() => {}),
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
  });

  assert.equal(dashboard.data.wallets.length, 1);
  assert.match(dashboard.chain.error ?? "", /Chain maturity reads timed out after 1ms/);
});

test("builds a manual mint preview response from the wallet chain count", async () => {
  const wallet = "0x1111111111111111111111111111111111111111";
  const preview = await buildMintPreviewResponse({
    today: "2026-05-13",
    plannedMintBatchSize: 50,
    readRows: () => [],
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
    getChainCounts: async (wallets) => {
      assert.deepEqual(wallets, [wallet]);
      return [
        {
          wallet,
          saltHex: "0x01",
          count: 35850,
          status: "ok",
          checkedAt: "2026-05-13T05:00:00.000Z",
        },
      ];
    },
  }, { sheet: "Connected", wallet, plannedCount: 120, termDays: 417 });

  assert.equal(preview.sheet, "Connected");
  assert.equal(preview.wallet, wallet);
  assert.equal(preview.idStart, 35851);
  assert.equal(preview.idEnd, 35970);
  assert.equal(preview.transactionCount, 3);
  assert.equal(preview.expiryDate, "2027-07-04");
});

test("manual mint preview honors single submit limit", async () => {
  const wallet = "0x1111111111111111111111111111111111111111";
  const preview = await buildMintPreviewResponse({
    today: "2026-05-13",
    plannedMintBatchSize: 50,
    readRows: () => [],
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
    getChainCounts: async () => [
      {
        wallet,
        saltHex: "0x01",
        count: 35850,
        status: "ok",
        checkedAt: "2026-05-13T05:00:00.000Z",
      },
    ],
  }, { sheet: "Connected", wallet, plannedCount: 120, termDays: 417, submitLimit: 80 });

  assert.equal(preview.transactionCount, 2);
  assert.equal(preview.transactions[0].count, 80);
  assert.equal(preview.transactions[0].idStart, 35851);
  assert.equal(preview.transactions[0].idEnd, 35930);
  assert.equal(preview.transactions[1].count, 40);
  assert.equal(preview.transactions[1].idStart, 35931);
  assert.equal(preview.transactions[1].idEnd, 35970);
});

test("manual mint preview rejects terms beyond the XEN max mint term", async () => {
  const wallet = "0x1111111111111111111111111111111111111111";
  await assert.rejects(
    buildMintPreviewResponse({
      today: "2026-05-13",
      readRows: () => [],
      getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
      getChainCounts: async () => [
        {
          wallet,
          saltHex: "0x01",
          count: 35850,
          status: "ok",
          checkedAt: "2026-05-13T05:00:00.000Z",
        },
      ],
    }, { sheet: "Connected", wallet, plannedCount: 120, termDays: 489 }),
    /termDays must be <= 488/,
  );
});

test("planned mint preview skips ids that chain count has already minted", async () => {
  const wallet = "0x1111111111111111111111111111111111111111";
  const preview = await buildMintPreviewResponse({
    today: "2026-05-09",
    plannedMintBatchSize: 50,
    readRows: () => [
      {
        sheet: "X7-8f39",
        rowNumber: 37,
        wallet,
        label: "35001-36000",
        mintDateRaw: null,
        termDaysRaw: null,
        expiryRaw: 270704,
        quantityRaw: 1000,
        claimAmountRaw: null,
      },
    ],
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
    getChainCounts: async () => [
      {
        wallet,
        saltHex: "0x01",
        count: 35050,
        status: "ok",
        checkedAt: "2026-05-09T06:20:00.000Z",
      },
    ],
  }, { sheet: "X7-8f39", plannedCount: 100, termDays: 421 });

  assert.equal(preview.ids[0], 35051);
  assert.equal(preview.ids.at(-1), 35150);
  assert.deepEqual(preview.transactions.map((tx) => [tx.idStart, tx.idEnd, tx.count]), [
    [35051, 35100, 50],
    [35101, 35150, 50],
  ]);
});

test("planned mint preview catches up ids when chain is behind a partially recorded row", async () => {
  const wallet = "0x1111111111111111111111111111111111111111";
  const preview = await buildMintPreviewResponse({
    today: "2026-05-13",
    plannedMintBatchSize: 50,
    readRows: () => [
      {
        sheet: "X7-8f39",
        rowNumber: 37,
        wallet,
        label: "35001-36000",
        mintDateRaw: 260509,
        termDaysRaw: 421,
        expiryRaw: 270704,
        quantityRaw: 850,
        claimAmountRaw: null,
      },
      {
        sheet: "X7-8f39",
        rowNumber: 38,
        wallet,
        label: "36001-37000",
        mintDateRaw: null,
        termDaysRaw: null,
        expiryRaw: 270704,
        quantityRaw: 1000,
        claimAmountRaw: null,
      },
    ],
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
    getChainCounts: async () => [
      {
        wallet,
        saltHex: "0x01",
        count: 35850,
        status: "ok",
        checkedAt: "2026-05-13T05:00:00.000Z",
      },
    ],
  }, { sheet: "X7-8f39", plannedCount: 150, termDays: 417 });

  assert.equal(preview.idStart, 35851);
  assert.equal(preview.idEnd, 36000);
  assert.equal(preview.termDays, 417);
  assert.equal(preview.expiryDate, "2027-07-04");
  assert.deepEqual(preview.transactions.map((tx) => [tx.idStart, tx.idEnd, tx.count]), [
    [35851, 35900, 50],
    [35901, 35950, 50],
    [35951, 36000, 50],
  ]);
});

test("builds a chain-verified claim+remint preview response", async () => {
  const preview = await buildClaimRemintPreviewResponse({
    today: "2026-05-09",
    claimBatchSize: 100,
    readRows: () => [
      {
        sheet: "X3-e599",
        rowNumber: 48,
        wallet: "0x2222222222222222222222222222222222222222",
        label: "22001-22500",
        mintDateRaw: 250321,
        termDaysRaw: 414,
        expiryRaw: 260509,
        quantityRaw: 500,
        claimAmountRaw: null,
      },
    ],
    getChainMintStatuses: async (candidates) => candidates.map((candidate) => ({
      ...candidate,
      proxyAddress: "0x0000000000000000000000000000000000000001",
      checkedAt: "2026-05-09T08:30:00.000Z",
      status: "claimable" as const,
      term: 414,
      maturityTs: 1_778_314_631,
      unlockTime: "2026-05-09T08:17:11.000Z",
      rank: 30_914_510,
    })),
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
  }, { sheet: "X3-e599", termDays: 469 });

  assert.equal(preview.kind, "claim_remint");
  assert.equal(preview.sheet, "X3-e599");
  assert.equal(preview.count, 500);
  assert.equal(preview.transactionCount, 5);
  assert.equal(preview.transactions[0].idStart, 22001);
  assert.equal(preview.transactions[4].idEnd, 22500);
  assert.match(preview.data, /^0xc2580804/);
});

test("builds a chain-verified claim-only preview response", async () => {
  const preview = await buildClaimPreviewResponse({
    today: "2026-05-09",
    claimBatchSize: 100,
    readRows: () => [
      {
        sheet: "X3-e599",
        rowNumber: 48,
        wallet: "0x2222222222222222222222222222222222222222",
        label: "22001-22500",
        mintDateRaw: 250321,
        termDaysRaw: 414,
        expiryRaw: 260509,
        quantityRaw: 500,
        claimAmountRaw: null,
      },
    ],
    getChainMintStatuses: async (candidates) => candidates.map((candidate) => ({
      ...candidate,
      proxyAddress: "0x0000000000000000000000000000000000000001",
      checkedAt: "2026-05-09T08:30:00.000Z",
      status: "claimable" as const,
      term: 414,
      maturityTs: 1_778_314_631,
      unlockTime: "2026-05-09T08:17:11.000Z",
      rank: 30_914_510,
    })),
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
  }, {
    sheet: "X3-e599",
    submitLimit: 100,
    selectedBatches: [
      { rowNumber: 48, idStart: 22001, idEnd: 22100 },
    ],
  });

  assert.equal(preview.kind, "claim");
  assert.equal(preview.sheet, "X3-e599");
  assert.equal(preview.count, 100);
  assert.equal(preview.transactionCount, 1);
  assert.deepEqual(preview.transactions[0].idRanges, ["22001-22100"]);
  assert.match(preview.data, /^0xc2580804/);
});

test("builds claim+remint preview response for selected batches and merge size", async () => {
  const preview = await buildClaimRemintPreviewResponse({
    today: "2026-05-09",
    claimBatchSize: 100,
    readRows: () => [
      {
        sheet: "X3-e599",
        rowNumber: 48,
        wallet: "0x2222222222222222222222222222222222222222",
        label: "1-100",
        mintDateRaw: 250321,
        termDaysRaw: 414,
        expiryRaw: 260509,
        quantityRaw: 100,
        claimAmountRaw: null,
      },
      {
        sheet: "X3-e599",
        rowNumber: 49,
        wallet: "0x2222222222222222222222222222222222222222",
        label: "101-125",
        mintDateRaw: 250321,
        termDaysRaw: 414,
        expiryRaw: 260509,
        quantityRaw: 25,
        claimAmountRaw: null,
      },
      {
        sheet: "X3-e599",
        rowNumber: 50,
        wallet: "0x2222222222222222222222222222222222222222",
        label: "226-250",
        mintDateRaw: 250321,
        termDaysRaw: 414,
        expiryRaw: 260509,
        quantityRaw: 25,
        claimAmountRaw: null,
      },
    ],
    getChainMintStatuses: async (candidates) => candidates.map((candidate) => ({
      ...candidate,
      proxyAddress: "0x0000000000000000000000000000000000000001",
      checkedAt: "2026-05-09T08:30:00.000Z",
      status: "claimable" as const,
      term: 414,
      maturityTs: 1_778_314_631,
      unlockTime: "2026-05-09T08:17:11.000Z",
      rank: 30_914_510,
    })),
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
  }, {
    sheet: "X3-e599",
    termDays: 469,
    mergeSize: 50,
    selectedBatches: [
      { rowNumber: 49, idStart: 101, idEnd: 125 },
      { rowNumber: 50, idStart: 226, idEnd: 250 },
    ],
  });

  assert.equal(preview.count, 50);
  assert.equal(preview.transactionCount, 1);
  assert.deepEqual(preview.transactions[0].idRanges, ["101-125", "226-250"]);
});

test("public claim+remint preview rebuilds candidates from the submitted wallet", async () => {
  const wallet = "0x2222222222222222222222222222222222222222";
  const preview = await buildClaimRemintPreviewResponse({
    publicMode: true,
    today: "2026-05-16",
    claimBatchSize: 100,
    getChainCounts: async (wallets) => {
      assert.deepEqual(wallets, [wallet]);
      return [
        {
          wallet,
          saltHex: "0x01",
          count: 23000,
          status: "ok",
          checkedAt: "2026-05-16T08:00:00.000Z",
        },
      ];
    },
    getChainMintStatuses: async (candidates) => {
      assert.ok(candidates.some((candidate) => candidate.sheet === "X3" && candidate.rowNumber === 22501 && candidate.idStart === 22501 && candidate.idEnd === 22501));
      assert.ok(candidates.some((candidate) => candidate.sheet === "X3" && candidate.rowNumber === 23000 && candidate.idStart === 23000 && candidate.idEnd === 23000));
      return candidates.map((candidate) => ({
        ...candidate,
        proxyAddress: "0x0000000000000000000000000000000000000001",
        checkedAt: "2026-05-16T08:00:01.000Z",
        status: candidate.idStart >= 22501 && candidate.idEnd <= 23000 ? "claimable" as const : "active" as const,
        term: 420,
        maturityTs: 1_778_314_631,
        unlockTime: "2026-05-16T08:25:35.000Z",
        rank: 30_916_572,
      }));
    },
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
  }, {
    sheet: "X3",
    wallet,
    termDays: 385,
    submitLimit: 100,
    selectedBatches: [
      { rowNumber: 22501, idStart: 22501, idEnd: 22600 },
      { rowNumber: 22601, idStart: 22601, idEnd: 22700 },
      { rowNumber: 22701, idStart: 22701, idEnd: 22800 },
      { rowNumber: 22801, idStart: 22801, idEnd: 22900 },
      { rowNumber: 22901, idStart: 22901, idEnd: 23000 },
    ],
  });

  assert.equal(preview.sheet, "X3");
  assert.equal(preview.wallet, wallet);
  assert.equal(preview.count, 500);
  assert.equal(preview.transactionCount, 5);
  assert.equal(preview.transactions[4].idEnd, 23000);
});

test("claim+remint preview response uses submit limit separately from selected card size", async () => {
  const preview = await buildClaimRemintPreviewResponse({
    today: "2026-05-09",
    readRows: () => [
      {
        sheet: "X3-e599",
        rowNumber: 49,
        wallet: "0x2222222222222222222222222222222222222222",
        label: "22401-22480",
        mintDateRaw: 250321,
        termDaysRaw: 414,
        expiryRaw: 260509,
        quantityRaw: 80,
        claimAmountRaw: null,
      },
      {
        sheet: "X3-e599",
        rowNumber: 50,
        wallet: "0x2222222222222222222222222222222222222222",
        label: "22481-22500",
        mintDateRaw: 250321,
        termDaysRaw: 414,
        expiryRaw: 260509,
        quantityRaw: 20,
        claimAmountRaw: null,
      },
    ],
    getChainMintStatuses: async (candidates) => candidates.map((candidate) => ({
      ...candidate,
      proxyAddress: "0x0000000000000000000000000000000000000001",
      checkedAt: "2026-05-09T08:30:00.000Z",
      status: "claimable" as const,
      term: 414,
      maturityTs: 1_778_314_631,
      unlockTime: "2026-05-09T08:17:11.000Z",
      rank: 30_914_510,
    })),
    getGas: async () => ({ source: "unavailable", gasPriceGwei: null }),
  }, {
    sheet: "X3-e599",
    termDays: 469,
    mergeSize: 80,
    submitLimit: 100,
    selectedBatches: [
      { rowNumber: 49, idStart: 22401, idEnd: 22480 },
      { rowNumber: 50, idStart: 22481, idEnd: 22500 },
    ],
  });

  assert.equal(preview.transactionCount, 1);
  assert.deepEqual(preview.transactions[0].idRanges, ["22401-22480", "22481-22500"]);
});
