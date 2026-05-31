import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { buildClaimPreview, buildClaimRemintPreview, buildMintPreview, type ClaimPreview, type ClaimRemintPreview, type MintPreview } from "./action-preview.ts";
import { buildDashboardData, type DashboardData } from "./dashboard-data.ts";
import {
  DEFAULT_COINTOOL_SALT_HEX,
  readCoinToolMintCounts,
  readCoinToolMintStatuses,
  readXenCurrentMaxTermDays,
  type ChainMintCandidate,
  type ChainMintCount,
  type ChainMintStatus,
} from "./chain.ts";
import { readEtherscanCoinToolTransactions } from "./etherscan.ts";
import { gasAllowsExecution, getGasSnapshot, type GasSnapshot } from "./gas.ts";
import { classifyWorkbookRows } from "./importer.ts";
import type { MintRecord, WorkbookRow } from "./models.ts";
import { buildCoinToolHistoryIndex, type CoinToolHistoryIndex, type CoinToolHistoryTransaction } from "./tx-history.ts";

const DEFAULT_STATIC_DIR = fileURLToPath(new URL("../public/", import.meta.url));
export const DEFAULT_CHAIN_STATUS_TIMEOUT_MS = 180_000;
const PUBLIC_WALLET_STATUS_CONCURRENCY = 2;
const PUBLIC_WALLET_STATUS_BATCH_SIZE = 50;
const PUBLIC_WALLET_STATUS_MIN_TIMEOUT_MS = 15_000;
const PUBLIC_WALLET_STATUS_MAX_TIMEOUT_MS = 60_000;
const FALLBACK_MAX_MINT_TERM_DAYS = 488;

export type DashboardServerOptions = {
  excelFile?: string;
  host?: string;
  port?: number;
  today?: string;
  dueSoonDays?: number;
  maxBatchSize?: number;
  claimBatchSize?: number;
  plannedMintBatchSize?: number;
  maxMintTermDays?: number;
  maxFeeGwei?: number;
  etherscanApiKey?: string;
  etherscanChainId?: number;
  rpcUrl?: string;
  rpcTimeoutMs?: number;
  chainStatusTimeoutMs?: number;
  publicMode?: boolean;
  generatedAt?: string;
  staticDir?: string;
  readRows?: () => WorkbookRow[] | Promise<WorkbookRow[]>;
  getGas?: () => Promise<GasSnapshot>;
  saltHex?: string;
  getChainCounts?: (wallets: string[]) => Promise<ChainMintCount[]>;
  getChainMintStatuses?: (candidates: ChainMintCandidate[]) => Promise<ChainMintStatus[]>;
  getCoinToolTransactions?: (wallets: string[]) => Promise<CoinToolHistoryTransaction[]>;
  getMaxMintTermDays?: () => Promise<number>;
};

type PublicWalletInput = {
  name?: string;
  wallet: string;
};

export function createDashboardServer(options: DashboardServerOptions): Server {
  const staticDir = options.staticDir ?? DEFAULT_STATIC_DIR;
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (request.method === "POST" && url.pathname === "/api/actions/mint-preview") {
        const body = await readJsonBody<{ sheet?: string; wallet?: string; plannedCount?: number; termDays?: number; submitLimit?: number }>(request);
        sendJson(response, 200, await buildMintPreviewResponse(options, {
          sheet: String(body.sheet ?? ""),
          wallet: body.wallet ? String(body.wallet) : undefined,
          plannedCount: parseOptionalPositiveInteger(body.plannedCount),
          termDays: parseOptionalPositiveInteger(body.termDays),
          submitLimit: parseOptionalPositiveInteger(body.submitLimit),
        }));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/actions/claim-remint-preview") {
        const body = await readJsonBody<{ sheet?: string; wallet?: string; termDays?: number; mergeSize?: number; submitLimit?: number; selectedBatches?: unknown }>(request);
        sendJson(response, 200, await buildClaimRemintPreviewResponse(options, {
          sheet: String(body.sheet ?? ""),
          wallet: body.wallet ? String(body.wallet) : undefined,
          termDays: parseOptionalPositiveInteger(body.termDays),
          mergeSize: parseOptionalPositiveInteger(body.mergeSize),
          submitLimit: parseOptionalPositiveInteger(body.submitLimit),
          selectedBatches: parseSelectedBatches(body.selectedBatches),
        }));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/actions/claim-preview") {
        const body = await readJsonBody<{ sheet?: string; wallet?: string; mergeSize?: number; submitLimit?: number; selectedBatches?: unknown }>(request);
        sendJson(response, 200, await buildClaimPreviewResponse(options, {
          sheet: String(body.sheet ?? ""),
          wallet: body.wallet ? String(body.wallet) : undefined,
          mergeSize: parseOptionalPositiveInteger(body.mergeSize),
          submitLimit: parseOptionalPositiveInteger(body.submitLimit),
          selectedBatches: parseSelectedBatches(body.selectedBatches),
        }));
        return;
      }
      if (request.method !== "GET") {
        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }
      if (url.pathname === "/api/dashboard") {
        sendJson(response, 200, await buildDashboardResponse(options, {
          connectedWallet: url.searchParams.get("connectedWallet") ?? undefined,
          monitoredWallets: parsePublicWallets(url.searchParams.get("wallets")),
        }));
        return;
      }
      await sendStatic(response, staticDir, url.pathname);
    } catch (error) {
      sendJson(response, 500, { error: (error as Error).message });
    }
  });
}

export async function buildMintPreviewResponse(
  options: DashboardServerOptions,
  input: { sheet: string; wallet?: string; plannedCount?: number; termDays?: number; submitLimit?: number },
): Promise<MintPreview> {
  const source = await readSourceRows(options);
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const plannedMintBatchSize = input.submitLimit ?? options.plannedMintBatchSize ?? 50;
  await assertMintTermWithinMax(input.termDays, options);
  if (!input.sheet && !input.wallet) {
    throw new Error("Missing sheet");
  }
  if (input.wallet) {
    if (!input.plannedCount) {
      throw new Error("Missing plannedCount");
    }
    if (!input.termDays) {
      throw new Error("Missing termDays");
    }
    const chainCounts = await readChainCounts(options, [input.wallet]);
    const chain = chainCounts.counts.find((count) => count.wallet.toLowerCase() === input.wallet!.toLowerCase());
    if (chain?.status !== "ok" || chain.count == null) {
      throw new Error(chainCounts.error ?? `Cannot read chain mint count for ${input.wallet}`);
    }
    return buildMintPreview(source.rows, {
      sheet: input.sheet || input.wallet,
      wallet: input.wallet,
      today,
      plannedMintBatchSize,
      plannedCount: input.plannedCount,
      startId: chain.count + 1,
      termDays: input.termDays,
      chainId: options.etherscanChainId ?? 1,
      saltHex: options.saltHex,
    });
  }
  const skipPlannedIds = await readPlannedMintSkipCount(options, source.rows, input.sheet, today);
  const chainMinted = await readPlannedMintChainCount(options, source.rows, input.sheet, today);
  return buildMintPreview(source.rows, {
    sheet: input.sheet,
    today,
    plannedMintBatchSize,
    plannedCount: input.plannedCount,
    skipPlannedIds,
    chainMinted,
    termDays: input.termDays,
    chainId: options.etherscanChainId ?? 1,
    saltHex: options.saltHex,
  });
}

async function readPlannedMintSkipCount(
  options: DashboardServerOptions,
  rows: WorkbookRow[],
  sheet: string,
  today: string,
): Promise<number> {
  const classification = classifyWorkbookRows(rows, { today });
  const plannedRecords = classification.records.filter((record) => record.sheet === sheet && record.status === "planned_mint");
  const firstPlannedId = Math.min(...plannedRecords.flatMap((record) => record.ranges.map((range) => range.start)));
  const wallet = plannedRecords[0]?.wallet;
  if (!wallet || !Number.isFinite(firstPlannedId)) {
    return 0;
  }
  const chainCounts = await readChainCounts(options, [wallet]);
  const chain = chainCounts.counts.find((count) => count.wallet.toLowerCase() === wallet.toLowerCase());
  if (chain?.status !== "ok" || chain.count == null) {
    return 0;
  }
  return Math.max(0, chain.count - firstPlannedId + 1);
}

async function readPlannedMintChainCount(
  options: DashboardServerOptions,
  rows: WorkbookRow[],
  sheet: string,
  today: string,
): Promise<number | undefined> {
  const classification = classifyWorkbookRows(rows, { today });
  const wallet = classification.records.find((record) => record.sheet === sheet)?.wallet;
  if (!wallet) {
    return undefined;
  }
  const chainCounts = await readChainCounts(options, [wallet]);
  const chain = chainCounts.counts.find((count) => count.wallet.toLowerCase() === wallet.toLowerCase());
  return chain?.status === "ok" && chain.count != null ? chain.count : undefined;
}

export async function buildClaimRemintPreviewResponse(
  options: DashboardServerOptions,
  input: {
    sheet: string;
    wallet?: string;
    termDays?: number;
    mergeSize?: number;
    submitLimit?: number;
    selectedBatches?: Array<{ rowNumber: number; idStart: number; idEnd: number }>;
  },
): Promise<ClaimRemintPreview> {
  const source = await readSourceRows(options);
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  if (!input.sheet) {
    throw new Error("Missing sheet");
  }
  if (!input.termDays) {
    throw new Error("Missing termDays");
  }
  await assertMintTermWithinMax(input.termDays, options);
  const claimBatchSize = options.claimBatchSize ?? 100;
  const candidates = await buildClaimPreviewCandidates(options, source, input, today, claimBatchSize);
  const statuses = await readChainMintStatuses(
    options,
    candidates,
  );
  if (statuses.error) {
    throw new Error(statuses.error);
  }
  return buildClaimRemintPreview(statuses.statuses, {
    sheet: input.sheet,
    today,
    termDays: input.termDays,
    claimBatchSize: input.submitLimit ?? input.mergeSize ?? claimBatchSize,
    selectedBatches: input.selectedBatches,
    chainId: options.etherscanChainId ?? 1,
    saltHex: options.saltHex,
  });
}

export async function buildClaimPreviewResponse(
  options: DashboardServerOptions,
  input: {
    sheet: string;
    wallet?: string;
    mergeSize?: number;
    submitLimit?: number;
    selectedBatches?: Array<{ rowNumber: number; idStart: number; idEnd: number }>;
  },
): Promise<ClaimPreview> {
  const source = await readSourceRows(options);
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  if (!input.sheet) {
    throw new Error("Missing sheet");
  }
  const claimBatchSize = options.claimBatchSize ?? 100;
  const candidates = await buildClaimPreviewCandidates(options, source, input, today, claimBatchSize);
  const statuses = await readChainMintStatuses(
    options,
    candidates,
  );
  if (statuses.error) {
    throw new Error(statuses.error);
  }
  return buildClaimPreview(statuses.statuses, {
    sheet: input.sheet,
    today,
    claimBatchSize: input.submitLimit ?? input.mergeSize ?? claimBatchSize,
    selectedBatches: input.selectedBatches,
    chainId: options.etherscanChainId ?? 1,
    saltHex: options.saltHex,
  });
}

async function buildClaimPreviewCandidates(
  options: DashboardServerOptions,
  source: { rows: WorkbookRow[]; kind: "public" | "excel" },
  input: { sheet: string; wallet?: string },
  today: string,
  claimBatchSize: number,
): Promise<ChainMintCandidate[]> {
  if (source.kind === "public") {
    const wallet = normalizeWalletAddress(input.wallet);
    if (!wallet) {
      throw new Error("Missing wallet");
    }
    const chainCounts = await readChainCounts(options, [wallet]);
    if (chainCounts.error) {
      throw new Error(chainCounts.error);
    }
    return buildPublicChainMintCandidates([{ name: input.sheet, wallet }], chainCounts.counts);
  }
  return buildChainMintCandidates(source.rows, {
    today,
    dueSoonDays: options.dueSoonDays ?? 14,
    claimBatchSize,
  }).filter((candidate) => candidate.sheet === input.sheet);
}

function parseOptionalPositiveInteger(value: unknown): number | undefined {
  if (value == null || value === "") {
    return undefined;
  }
  const number = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(number) || number <= 0) {
    return undefined;
  }
  return number;
}

function parseSelectedBatches(value: unknown): Array<{ rowNumber: number; idStart: number; idEnd: number }> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const batches = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const row = item as Record<string, unknown>;
      const rowNumber = parseOptionalPositiveInteger(row.rowNumber);
      const idStart = parseOptionalPositiveInteger(row.idStart);
      const idEnd = parseOptionalPositiveInteger(row.idEnd);
      if (!rowNumber || !idStart || !idEnd || idEnd < idStart) {
        return null;
      }
      return { rowNumber, idStart, idEnd };
    })
    .filter((item): item is { rowNumber: number; idStart: number; idEnd: number } => item != null);
  return batches.length > 0 ? batches : undefined;
}

function parsePublicWallets(value: string | null): PublicWalletInput[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => {
        if (typeof item === "string") {
          return { wallet: item };
        }
        if (item && typeof item === "object" && "wallet" in item) {
          return {
            name: "name" in item && typeof item.name === "string" ? item.name : undefined,
            wallet: String(item.wallet),
          };
        }
        return null;
      })
      .filter((item): item is PublicWalletInput => item != null);
  } catch {
    return [];
  }
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {} as T;
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

export async function buildDashboardResponse(
  options: DashboardServerOptions,
  sourceOptions: { connectedWallet?: string; monitoredWallets?: PublicWalletInput[] } = {},
): Promise<{
  data: ReturnType<typeof buildDashboardData>;
  gas: {
    snapshot: GasSnapshot & { error?: string };
    maxFeeGwei: number | null;
    allowed: boolean;
  };
  source: {
    kind: "public" | "excel";
    storageKind: "public" | "excel";
    displayName: string;
    detail: string | null;
    url: string | null;
    syncedAt: string | null;
    localPath: string | null;
    warning: string | null;
  };
  chain: {
    enabled: boolean;
    rpcUrl: string | null;
    saltHex: string;
    checkedAt: string | null;
    checkedWallets: number;
    mismatchedWallets: number;
    errorWallets: number;
    error: string | null;
  };
}> {
  const source = await readSourceRows(options, sourceOptions);
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const connectedWallet = normalizeWalletAddress(sourceOptions.connectedWallet);
  const monitoredWallets = normalizePublicWallets(sourceOptions.monitoredWallets ?? []);
  const maxFeeGwei = options.maxFeeGwei ?? Number(process.env.MAX_FEE_GWEI ?? "0");
  const maxMintTermDays = await readMaxMintTermDays(options);
  const dataOptions = {
    today,
    dueSoonDays: options.dueSoonDays ?? 14,
    maxBatchSize: options.maxBatchSize ?? 100,
    claimBatchSize: options.claimBatchSize ?? 100,
    plannedMintBatchSize: options.plannedMintBatchSize ?? 50,
    maxMintTermDays,
    sourcePath: source.displayPath,
    generatedAt: options.generatedAt,
  };
  const uncheckedData = buildDashboardData(source.rows, dataOptions);
  const chainCountWallets = uniqueWallets([
    ...uncheckedData.wallets.map((wallet) => wallet.wallet),
    ...monitoredWallets.map((wallet) => wallet.wallet),
    ...(connectedWallet ? [connectedWallet] : []),
  ]);
  const workbookChainStatusCandidates = buildChainMintCandidates(source.rows, {
    today,
    dueSoonDays: dataOptions.dueSoonDays,
    claimBatchSize: dataOptions.claimBatchSize,
  });
  const [snapshot, chainCounts, chainHistory] = await Promise.all([
    readGas(options),
    readChainCounts(options, chainCountWallets),
    readCoinToolHistory(options, chainCountWallets),
  ]);
  const publicWalletsForStatus = normalizePublicWallets([
    ...monitoredWallets,
    ...(connectedWallet ? [{ wallet: connectedWallet }] : []),
  ]);
  const publicChainStatusCandidates = source.kind === "public"
    ? []
    : buildPublicDashboardChainMintCandidates(publicWalletsForStatus, chainCounts.counts, chainHistory);
  const chainStatusCandidates = mergeChainMintCandidates(workbookChainStatusCandidates, publicChainStatusCandidates);
  const chainMintStatuses = source.kind === "public"
    ? await readPublicDashboardChainMintStatuses(options, publicWalletsForStatus, chainCounts.counts, chainHistory)
    : await readDashboardChainMintStatuses(options, chainStatusCandidates);
  const data = buildDashboardData(source.rows, {
    ...dataOptions,
    chainMintCounts: chainCounts.counts,
    chainMintStatuses: chainMintStatuses.statuses,
    chainHistory,
  });
  appendPublicWallets(data, monitoredWallets, connectedWallet, chainCounts.counts);
  return {
    data,
    gas: {
      snapshot,
      maxFeeGwei: maxFeeGwei > 0 ? maxFeeGwei : null,
      allowed: maxFeeGwei > 0 ? gasAllowsExecution(snapshot, maxFeeGwei) : false,
    },
    source: {
      kind: source.kind,
      storageKind: source.kind,
      displayName: source.displayName,
      detail: source.detail,
      url: source.url,
      syncedAt: source.syncedAt,
      localPath: source.localPath,
      warning: source.warning,
    },
    chain: {
      enabled: chainCounts.enabled,
      rpcUrl: chainCounts.rpcUrl,
      saltHex: chainCounts.saltHex,
      checkedAt: chainCounts.checkedAt,
      checkedWallets: data.summary.chainCheckedWallets,
      mismatchedWallets: data.summary.chainMismatchedWallets,
      errorWallets: chainCounts.counts.filter((row) => row.status === "error").length,
      error: chainCounts.error ?? chainMintStatuses.error,
    },
  };
}

async function assertMintTermWithinMax(termDays: number | undefined, options: DashboardServerOptions): Promise<void> {
  if (termDays == null) {
    return;
  }
  const maxMintTermDays = await readMaxMintTermDays(options);
  if (termDays > maxMintTermDays) {
    throw new Error(`termDays must be <= ${maxMintTermDays}`);
  }
}

async function readMaxMintTermDays(options: DashboardServerOptions): Promise<number> {
  if (options.maxMintTermDays != null) {
    return options.maxMintTermDays;
  }
  if (options.getMaxMintTermDays) {
    return options.getMaxMintTermDays();
  }
  if (!options.rpcUrl) {
    return FALLBACK_MAX_MINT_TERM_DAYS;
  }
  return readXenCurrentMaxTermDays({
    rpcUrl: options.rpcUrl,
    rpcTimeoutMs: options.rpcTimeoutMs,
  }).catch(() => FALLBACK_MAX_MINT_TERM_DAYS);
}

async function readCoinToolHistory(
  options: DashboardServerOptions,
  wallets: string[],
): Promise<CoinToolHistoryIndex | undefined> {
  if (!options.getCoinToolTransactions) {
    const apiKey = options.etherscanApiKey ?? process.env.ETHERSCAN_API_KEY;
    if (!apiKey) {
      return undefined;
    }
    try {
      return buildCoinToolHistoryIndex(await readEtherscanCoinToolTransactions(wallets, {
        apiKey,
        chainId: options.etherscanChainId,
        timeoutMs: options.rpcTimeoutMs,
      }));
    } catch {
      return undefined;
    }
  }
  return buildCoinToolHistoryIndex(await options.getCoinToolTransactions(wallets));
}

function appendPublicWallets(
  data: DashboardData,
  monitoredWallets: PublicWalletInput[],
  connectedWallet: string | undefined,
  chainCounts: ChainMintCount[],
): void {
  const wallets = [
    ...monitoredWallets,
    ...(connectedWallet ? [{ wallet: connectedWallet }] : []),
  ];
  for (const wallet of wallets) {
    appendPublicWallet(data, wallet, chainCounts);
  }
  data.wallets.sort((a, b) => (
    (a.nextUnlockTime ?? a.nextExpiryDate ?? "9999-12-31T23:59:59.999Z")
      .localeCompare(b.nextUnlockTime ?? b.nextExpiryDate ?? "9999-12-31T23:59:59.999Z") ||
    a.sheet.localeCompare(b.sheet)
  ));
  data.summary.wallets = data.wallets.length;
  data.summary.chainCheckedWallets = data.wallets.filter((row) => row.chainStatus !== "unchecked").length;
  data.summary.chainMismatchedWallets = data.wallets.filter((row) => row.chainStatus === "ok" && row.chainDelta != null && row.chainDelta !== 0).length;
}

function appendPublicWallet(
  data: DashboardData,
  input: PublicWalletInput,
  chainCounts: ChainMintCount[],
): void {
  const wallet = input.wallet;
  if (data.wallets.some((row) => row.wallet.toLowerCase() === wallet.toLowerCase())) {
    return;
  }
  const chain = chainCounts.find((count) => count.wallet.toLowerCase() === wallet.toLowerCase());
  data.wallets.push({
    sheet: publicWalletName(input),
    wallet,
    activeMint: 0,
    claimable: 0,
    claimed: 0,
    plannedMint: 0,
    queuedClaimRemint: 0,
    queuedPlannedMint: 0,
    needsReview: 0,
    nextExpiryDate: null,
    nextUnlockTime: null,
    nextUnlockQuantity: 0,
    sheetMintedIds: chain?.status === "ok" && chain.count != null ? chain.count : 0,
    chainMinted: chain?.status === "ok" && chain.count != null ? chain.count : null,
    chainDelta: null,
    chainStatus: chain?.status === "ok" ? "ok" : chain ? "error" : "unchecked",
    chainError: chain?.error ?? null,
    manualActions: {
      mint: { count: 0, enabled: chain?.status === "ok", idStart: null, idEnd: null, idRanges: [] },
      claim: { count: 0, enabled: false, idStart: null, idEnd: null, idRanges: [] },
      claimRemint: { count: 0, enabled: false, idStart: null, idEnd: null, idRanges: [], defaultTermDays: 469 },
    },
  });
}

function buildPublicChainMintCandidates(
  wallets: PublicWalletInput[],
  chainCounts: ChainMintCount[],
  chainHistory?: CoinToolHistoryIndex,
): ChainMintCandidate[] {
  const candidates: ChainMintCandidate[] = [];
  for (const input of wallets) {
    const chain = chainCounts.find((count) => count.wallet.toLowerCase() === input.wallet.toLowerCase());
    if (chain?.status !== "ok" || !chain.count || chain.count <= 0) {
      continue;
    }
    const historyRanges = chainHistory?.currentRanges(input.wallet) ?? [];
    if (historyRanges.length > 0) {
      for (const range of historyRanges) {
        candidates.push({
          sheet: publicWalletName(input),
          rowNumber: range.idStart,
          wallet: input.wallet,
          idStart: range.idStart,
          idEnd: range.idEnd,
          label: prefixedRangeLabel(range.remintRound, range.idStart, range.idEnd),
          baseLabel: formatIdRange(range.idStart, range.idEnd),
          remintRound: range.remintRound,
        });
      }
      continue;
    }
    for (let start = 1; start <= chain.count; start += 1) {
      const end = start;
      candidates.push({
        sheet: publicWalletName(input),
        rowNumber: start,
        wallet: input.wallet,
        idStart: start,
        idEnd: end,
        label: formatIdRange(start, end),
        baseLabel: formatIdRange(start, end),
        remintRound: 0,
      });
    }
  }
  return candidates;
}

function buildPublicDashboardChainMintCandidates(
  wallets: PublicWalletInput[],
  chainCounts: ChainMintCount[],
  chainHistory?: CoinToolHistoryIndex,
): ChainMintCandidate[] {
  const candidates: ChainMintCandidate[] = [];
  for (const input of wallets) {
    const chain = chainCounts.find((count) => count.wallet.toLowerCase() === input.wallet.toLowerCase());
    if (chain?.status !== "ok" || !chain.count || chain.count <= 0) {
      continue;
    }
    const historyRanges = chainHistory?.currentRanges(input.wallet) ?? [];
    if (historyRanges.length > 0) {
      candidates.push(...buildPublicChainMintCandidates([input], chainCounts, chainHistory));
      continue;
    }
    for (let start = 1; start <= chain.count; start += PUBLIC_WALLET_STATUS_BATCH_SIZE) {
      const end = Math.min(chain.count, start + PUBLIC_WALLET_STATUS_BATCH_SIZE - 1);
      candidates.push({
        sheet: publicWalletName(input),
        rowNumber: start,
        wallet: input.wallet,
        idStart: start,
        idEnd: end,
        label: formatIdRange(start, end),
        baseLabel: formatIdRange(start, end),
        remintRound: 0,
      });
    }
  }
  return candidates;
}

function mergeChainMintCandidates(
  primary: ChainMintCandidate[],
  extra: ChainMintCandidate[],
): ChainMintCandidate[] {
  const seen = new Set(primary.map(chainMintCandidateKey));
  const merged = [...primary];
  for (const candidate of extra) {
    const key = chainMintCandidateKey(candidate);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(candidate);
  }
  return merged;
}

function chainMintCandidateKey(candidate: ChainMintCandidate): string {
  return `${candidate.wallet.toLowerCase()}:${candidate.idStart}:${candidate.idEnd}`;
}

function publicWalletName(input: PublicWalletInput): string {
  const name = input.name?.trim();
  return name || shortPublicWallet(input.wallet);
}

function shortPublicWallet(wallet: string): string {
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function normalizeWalletAddress(wallet: string | null | undefined): string | undefined {
  const normalized = wallet?.trim();
  return normalized && /^0x[0-9a-fA-F]{40}$/.test(normalized) ? normalized : undefined;
}

function normalizePublicWallets(wallets: PublicWalletInput[]): PublicWalletInput[] {
  const seen = new Set<string>();
  const normalized: PublicWalletInput[] = [];
  for (const input of wallets) {
    const wallet = normalizeWalletAddress(input.wallet);
    if (!wallet) {
      continue;
    }
    const key = wallet.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push({ name: input.name?.trim() || undefined, wallet });
  }
  return normalized;
}

function uniqueWallets(wallets: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const wallet of wallets) {
    const key = wallet.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(wallet);
  }
  return unique;
}

function buildChainMintCandidates(
  rows: WorkbookRow[],
  options: { today: string; dueSoonDays: number; claimBatchSize: number },
): ChainMintCandidate[] {
  const classification = classifyWorkbookRows(rows, { today: options.today });
  const candidates: ChainMintCandidate[] = [];
  for (const record of classification.records) {
    if (!shouldReadChainMintStatus(record)) {
      continue;
    }
    for (const range of record.ranges) {
      for (let start = range.start; start <= range.end; start += options.claimBatchSize) {
        const end = Math.min(range.end, start + options.claimBatchSize - 1);
        candidates.push({
          sheet: record.sheet,
          rowNumber: record.rowNumber,
          wallet: record.wallet,
          idStart: start,
          idEnd: end,
          label: prefixedRangeLabel(record.remintRound ?? 0, start, end),
          baseLabel: formatIdRange(start, end),
          remintRound: record.remintRound ?? 0,
        });
      }
    }
  }
  return candidates;
}

function prefixedRangeLabel(remintRound: number, start: number, end: number): string {
  const base = formatIdRange(start, end);
  return remintRound > 0 ? `${"F".repeat(remintRound)} ${base}` : base;
}

function formatIdRange(start: number, end: number): string {
  return start === end ? String(start) : `${start}-${end}`;
}

function shouldReadChainMintStatus(record: MintRecord): boolean {
  if (record.status === "claimable") {
    return true;
  }
  return record.status === "active_mint" && Boolean(record.expiryDate);
}

async function readChainCounts(
  options: DashboardServerOptions,
  wallets: string[],
): Promise<{
  enabled: boolean;
  rpcUrl: string | null;
  saltHex: string;
  checkedAt: string | null;
  counts: ChainMintCount[];
  error: string | null;
}> {
  const saltHex = options.saltHex ?? process.env.COINTOOL_SALT_HEX ?? DEFAULT_COINTOOL_SALT_HEX;
  const rpcUrl = options.rpcUrl ?? process.env.RPC_URL ?? null;
  if (options.getChainCounts) {
    const counts = await options.getChainCounts(wallets);
    return {
      enabled: true,
      rpcUrl,
      saltHex,
      checkedAt: latestCheckedAt(counts),
      counts,
      error: null,
    };
  }
  if (!rpcUrl) {
    return {
      enabled: false,
      rpcUrl: null,
      saltHex,
      checkedAt: null,
      counts: [],
      error: "RPC_URL is not configured",
    };
  }
  try {
    const counts = await readCoinToolMintCounts(wallets, { rpcUrl, saltHex, rpcTimeoutMs: options.rpcTimeoutMs });
    return {
      enabled: true,
      rpcUrl,
      saltHex,
      checkedAt: latestCheckedAt(counts),
      counts,
      error: null,
    };
  } catch (error) {
    return {
      enabled: true,
      rpcUrl,
      saltHex,
      checkedAt: null,
      counts: [],
      error: (error as Error).message,
    };
  }
}

async function readChainMintStatuses(
  options: DashboardServerOptions,
  candidates: ChainMintCandidate[],
): Promise<{
  enabled: boolean;
  rpcUrl: string | null;
  saltHex: string;
  statuses: ChainMintStatus[];
  error: string | null;
}> {
  const saltHex = options.saltHex ?? process.env.COINTOOL_SALT_HEX ?? DEFAULT_COINTOOL_SALT_HEX;
  const rpcUrl = options.rpcUrl ?? process.env.RPC_URL ?? null;
  if (candidates.length === 0) {
    return { enabled: Boolean(rpcUrl || options.getChainMintStatuses), rpcUrl, saltHex, statuses: [], error: null };
  }
  if (options.getChainMintStatuses) {
    return {
      enabled: true,
      rpcUrl,
      saltHex,
      statuses: compactChainMintStatuses(await options.getChainMintStatuses(candidates)),
      error: null,
    };
  }
  if (!rpcUrl) {
    return {
      enabled: false,
      rpcUrl: null,
      saltHex,
      statuses: [],
      error: "RPC_URL is not configured",
    };
  }
  try {
    return {
      enabled: true,
      rpcUrl,
      saltHex,
      statuses: compactChainMintStatuses(await readCoinToolMintStatuses(candidates, { rpcUrl, saltHex, rpcTimeoutMs: options.rpcTimeoutMs })),
      error: null,
    };
  } catch (error) {
    return {
      enabled: true,
      rpcUrl,
      saltHex,
      statuses: [],
      error: (error as Error).message,
    };
  }
}

function readDashboardChainMintStatuses(
  options: DashboardServerOptions,
  candidates: ChainMintCandidate[],
): Promise<{
  enabled: boolean;
  rpcUrl: string | null;
  saltHex: string;
  statuses: ChainMintStatus[];
  error: string | null;
}> {
  const timeoutMs = options.chainStatusTimeoutMs ?? Number(process.env.CHAIN_STATUS_TIMEOUT_MS ?? DEFAULT_CHAIN_STATUS_TIMEOUT_MS);
  const saltHex = options.saltHex ?? process.env.COINTOOL_SALT_HEX ?? DEFAULT_COINTOOL_SALT_HEX;
  const rpcUrl = options.rpcUrl ?? process.env.RPC_URL ?? null;
  return withChainStatusTimeout(
    readChainMintStatuses(options, candidates),
    timeoutMs,
    {
      enabled: Boolean(rpcUrl || options.getChainMintStatuses),
      rpcUrl,
      saltHex,
      statuses: [],
      error: `Chain maturity reads timed out after ${timeoutMs}ms`,
    },
  );
}

function readPublicDashboardChainMintStatuses(
  options: DashboardServerOptions,
  wallets: PublicWalletInput[],
  chainCounts: ChainMintCount[],
  chainHistory?: CoinToolHistoryIndex,
): Promise<{
  enabled: boolean;
  rpcUrl: string | null;
  saltHex: string;
  statuses: ChainMintStatus[];
  error: string | null;
}> {
  const timeoutMs = options.chainStatusTimeoutMs ?? Number(process.env.CHAIN_STATUS_TIMEOUT_MS ?? DEFAULT_CHAIN_STATUS_TIMEOUT_MS);
  const saltHex = options.saltHex ?? process.env.COINTOOL_SALT_HEX ?? DEFAULT_COINTOOL_SALT_HEX;
  const rpcUrl = options.rpcUrl ?? process.env.RPC_URL ?? null;
  const walletTimeoutMs = publicWalletStatusTimeoutMs(timeoutMs, wallets.length);
  return mapWithConcurrency(
    wallets,
    PUBLIC_WALLET_STATUS_CONCURRENCY,
    (wallet) => readPublicWalletNextMintStatusesWithTimeout(options, wallet, chainCounts, chainHistory, walletTimeoutMs),
  ).then((statuses) => {
    const flatStatuses = statuses.flat();
    return {
      enabled: Boolean(rpcUrl || options.getChainMintStatuses),
      rpcUrl,
      saltHex,
      statuses: flatStatuses,
      error: firstChainStatusError(flatStatuses),
    };
  });
}

function publicWalletStatusTimeoutMs(totalTimeoutMs: number, walletCount: number): number {
  if (totalTimeoutMs <= PUBLIC_WALLET_STATUS_MIN_TIMEOUT_MS || walletCount <= PUBLIC_WALLET_STATUS_CONCURRENCY) {
    return totalTimeoutMs;
  }
  const waves = Math.ceil(walletCount / PUBLIC_WALLET_STATUS_CONCURRENCY);
  const waveBudget = Math.floor(totalTimeoutMs / waves);
  return Math.min(
    PUBLIC_WALLET_STATUS_MAX_TIMEOUT_MS,
    Math.max(PUBLIC_WALLET_STATUS_MIN_TIMEOUT_MS, waveBudget),
  );
}

function firstChainStatusError(statuses: ChainMintStatus[]): string | null {
  return statuses.find((status) => status.status === "error" && status.error)?.error ?? null;
}

function readPublicWalletNextMintStatusesWithTimeout(
  options: DashboardServerOptions,
  input: PublicWalletInput,
  chainCounts: ChainMintCount[],
  chainHistory: CoinToolHistoryIndex | undefined,
  timeoutMs: number,
): Promise<ChainMintStatus[]> {
  const timeoutError = `Chain maturity reads timed out after ${timeoutMs}ms`;
  return withTimeout(
    readPublicWalletNextMintStatuses(options, input, chainCounts, chainHistory).catch((error) => (
      buildPublicChainMintErrorStatuses([input], chainCounts, chainHistory, error instanceof Error ? error.message : String(error))
    )),
    timeoutMs,
    buildPublicChainMintErrorStatuses([input], chainCounts, chainHistory, timeoutError),
  );
}

function buildPublicChainMintErrorStatuses(
  wallets: PublicWalletInput[],
  chainCounts: ChainMintCount[],
  chainHistory: CoinToolHistoryIndex | undefined,
  error: string,
): ChainMintStatus[] {
  const checkedAt = new Date().toISOString();
  const statuses: ChainMintStatus[] = [];
  for (const input of wallets) {
    const historyRanges = chainHistory?.currentRanges(input.wallet) ?? [];
    if (historyRanges.length > 0) {
      statuses.push(...historyRanges.map((range) => ({
        sheet: publicWalletName(input),
        rowNumber: range.idStart,
        wallet: input.wallet,
        idStart: range.idStart,
        idEnd: range.idEnd,
        label: prefixedRangeLabel(range.remintRound, range.idStart, range.idEnd),
        baseLabel: formatIdRange(range.idStart, range.idEnd),
        remintRound: range.remintRound,
        proxyAddress: "",
        checkedAt,
        status: "error" as const,
        term: null,
        maturityTs: null,
        unlockTime: null,
        rank: null,
        error,
      })));
      continue;
    }
    const chain = chainCounts.find((count) => count.wallet.toLowerCase() === input.wallet.toLowerCase());
    if (chain?.status !== "ok" || !chain.count || chain.count <= 0) {
      continue;
    }
    statuses.push({
      sheet: publicWalletName(input),
      rowNumber: 1,
      wallet: input.wallet,
      idStart: 1,
      idEnd: chain.count,
      label: formatIdRange(1, chain.count),
      baseLabel: formatIdRange(1, chain.count),
      remintRound: 0,
      proxyAddress: "",
      checkedAt,
      status: "error",
      term: null,
      maturityTs: null,
      unlockTime: null,
      rank: null,
      error,
    });
  }
  return statuses;
}

async function readPublicWalletNextMintStatuses(
  options: DashboardServerOptions,
  input: PublicWalletInput,
  chainCounts: ChainMintCount[],
  chainHistory?: CoinToolHistoryIndex,
): Promise<ChainMintStatus[]> {
  const chain = chainCounts.find((count) => count.wallet.toLowerCase() === input.wallet.toLowerCase());
  if (chain?.status !== "ok" || !chain.count || chain.count <= 0) {
    return [];
  }
  const candidates = buildPublicDashboardChainMintCandidates([input], chainCounts, chainHistory);
  return readPublicWalletMintStatusBatch(options, candidates);
}

async function readPublicWalletMintStatusBatch(
  options: DashboardServerOptions,
  candidates: ChainMintCandidate[],
): Promise<ChainMintStatus[]> {
  if (candidates.length === 0) {
    return [];
  }
  const result = await readChainMintStatuses(options, candidates);
  if (result.statuses.length > 0) {
    return compactChainMintStatuses(result.statuses);
  }
  const checkedAt = new Date().toISOString();
  return compactChainMintStatuses(candidates.map((candidate) => ({
    ...candidate,
    proxyAddress: "",
    checkedAt,
    status: "error",
    term: null,
    maturityTs: null,
    unlockTime: null,
    rank: null,
    error: result.error ?? "Chain maturity read failed",
  })));
}

function compactChainMintStatuses(statuses: ChainMintStatus[]): ChainMintStatus[] {
  const compacted: ChainMintStatus[] = [];
  const sorted = [...statuses].sort((a, b) => (
    a.sheet.localeCompare(b.sheet) ||
    a.wallet.localeCompare(b.wallet) ||
    a.idStart - b.idStart ||
    a.idEnd - b.idEnd
  ));
  for (const status of sorted) {
    const previous = compacted.at(-1);
    if (!previous || !canCompactChainMintStatus(previous, status)) {
      compacted.push({ ...status });
      continue;
    }
    previous.idEnd = status.idEnd;
    previous.baseLabel = formatIdRange(previous.idStart, previous.idEnd);
    previous.label = prefixedRangeLabel(previous.remintRound ?? 0, previous.idStart, previous.idEnd);
  }
  return compacted;
}

function canCompactChainMintStatus(previous: ChainMintStatus, next: ChainMintStatus): boolean {
  return (
    previous.sheet === next.sheet &&
    previous.wallet.toLowerCase() === next.wallet.toLowerCase() &&
    previous.idEnd + 1 === next.idStart &&
    previous.status === next.status &&
    previous.unlockTime === next.unlockTime &&
    previous.maturityTs === next.maturityTs &&
    previous.term === next.term &&
    previous.remintRound === next.remintRound &&
    previous.error === next.error
  );
}

async function mapWithConcurrency<T, U>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function withChainStatusTimeout(
  promise: Promise<{
    enabled: boolean;
    rpcUrl: string | null;
    saltHex: string;
    statuses: ChainMintStatus[];
    error: string | null;
  }>,
  timeoutMs: number,
  fallback: {
    enabled: boolean;
    rpcUrl: string | null;
    saltHex: string;
    statuses: ChainMintStatus[];
    error: string | null;
  },
): Promise<{
  enabled: boolean;
  rpcUrl: string | null;
  saltHex: string;
  statuses: ChainMintStatus[];
  error: string | null;
}> {
  return withTimeout(promise, timeoutMs, fallback);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function latestCheckedAt(counts: ChainMintCount[]): string | null {
  return counts.reduce<string | null>((latest, row) => {
    return latest == null || row.checkedAt > latest ? row.checkedAt : latest;
  }, null);
}

async function readSourceRows(
  options: DashboardServerOptions,
): Promise<{
  rows: WorkbookRow[];
  kind: "public" | "excel";
  path: string;
  displayPath: string;
  displayName: string;
  detail: string | null;
  url: string | null;
  syncedAt: string | null;
  localPath: string | null;
  warning: string | null;
}> {
  if (options.publicMode) {
    return {
      rows: [],
      kind: "public",
      path: "public-chain",
      displayPath: "public-chain",
      displayName: "公版链上监控",
      detail: null,
      url: null,
      syncedAt: null,
      localPath: null,
      warning: null,
    };
  }
  if (options.readRows) {
    const path = options.excelFile ?? "injected-data";
    return {
      rows: await options.readRows(),
      kind: "excel",
      path,
      displayPath: path,
      displayName: "本地 Excel",
      detail: path,
      url: null,
      syncedAt: null,
      localPath: path,
      warning: null,
    };
  }
  throw new Error("This public build only supports wallet monitoring mode.");
}

export function listenDashboardServer(options: DashboardServerOptions): Promise<{ server: Server; url: string }> {
  const server = createDashboardServer(options);
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 4173;
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve({ server, url: `http://${host}:${(server.address() as { port: number }).port}` });
    });
  });
}

async function readGas(options: DashboardServerOptions): Promise<GasSnapshot & { error?: string }> {
  try {
    return await (options.getGas ? options.getGas() : getGasSnapshot(options.rpcUrl ?? process.env.RPC_URL, {
      timeoutMs: options.rpcTimeoutMs,
    }));
  } catch (error) {
    return { source: "unavailable", gasPriceGwei: null, error: (error as Error).message };
  }
}

async function sendStatic(response: ServerResponse, staticDir: string, pathname: string): Promise<void> {
  const asset = await readDashboardAsset(pathname, staticDir);
  response.writeHead(200, { "content-type": asset.contentType, "cache-control": "no-store" });
  response.end(asset.bytes);
}

export async function readDashboardAsset(pathname: string, staticDir = DEFAULT_STATIC_DIR): Promise<{
  bytes: Buffer;
  text: string;
  contentType: string;
}> {
  const relativePath = pathname === "/" ? "dashboard.html" : decodeURIComponent(pathname.slice(1));
  const safePath = normalize(relativePath);
  if (safePath.startsWith("..") || safePath.startsWith("/")) {
    throw new Error("Invalid path");
  }
  const filePath = new URL(`../public/${safePath}`, import.meta.url);
  const bytes = await readFile(staticDir === DEFAULT_STATIC_DIR ? filePath : `${staticDir}/${safePath}`);
  return { bytes, text: bytes.toString("utf8"), contentType: contentType(safePath) };
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(payload, null, 2));
}

function contentType(filePath: string): string {
  if (extname(filePath) === ".css") {
    return "text/css; charset=utf-8";
  }
  if (extname(filePath) === ".js") {
    return "text/javascript; charset=utf-8";
  }
  if (extname(filePath) === ".svg") {
    return "image/svg+xml; charset=utf-8";
  }
  return "text/html; charset=utf-8";
}
