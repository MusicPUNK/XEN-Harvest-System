import { classifyWorkbookRows } from "./importer.ts";
import type { ChainMintCount, ChainMintStatus } from "./chain.ts";
import type { MintRecord, QueueItem, Range, ReviewItem, WorkbookRow } from "./models.ts";
import { buildQueueItems } from "./queue.ts";
import type { CoinToolHistoryIndex } from "./tx-history.ts";

const DEFAULT_REMINT_TERM_DAYS = 469;
const DEFAULT_MAX_MINT_TERM_DAYS = 488;

export type DashboardOptions = {
  today: string;
  dueSoonDays?: number;
  maxBatchSize?: number;
  claimBatchSize?: number;
  plannedMintBatchSize?: number;
  sourcePath?: string;
  generatedAt?: string;
  chainMintCounts?: ChainMintCount[];
  chainMintStatuses?: ChainMintStatus[];
  chainHistory?: CoinToolHistoryIndex;
  maxMintTermDays?: number;
  nowTs?: number;
};

export type DashboardData = {
  metadata: {
    sourcePath: string | null;
    today: string;
    generatedAt: string;
    dueSoonDays: number;
    maxBatchSize: number;
    claimBatchSize: number;
    plannedMintBatchSize: number;
    maxMintTermDays: number;
    readOnly: true;
  };
  summary: {
    activeMint: number;
    claimable: number;
    claimed: number;
    plannedMint: number;
    needsReview: number;
    queuedClaimRemint: number;
    queuedPlannedMint: number;
    queueChunks: number;
    wallets: number;
    chainCheckedWallets: number;
    chainMismatchedWallets: number;
  };
  wallets: WalletDashboardRow[];
  claimable: DashboardRecordRow[];
  dueSoon: DashboardRecordRow[];
  allMint: DashboardRecordRow[];
  plannedMint: DashboardRecordRow[];
  reviews: ReviewItem[];
};

export type WalletDashboardRow = {
  sheet: string;
  wallet: string;
  activeMint: number;
  claimable: number;
  claimed: number;
  plannedMint: number;
  queuedClaimRemint: number;
  queuedPlannedMint: number;
  needsReview: number;
  nextExpiryDate: string | null;
  nextUnlockTime: string | null;
  nextUnlockQuantity: number;
  sheetMintedIds: number;
  chainMinted: number | null;
  chainDelta: number | null;
  chainStatus: "unchecked" | "ok" | "error";
  chainError: string | null;
  manualActions: WalletManualActions;
};

export type WalletManualActions = {
  mint: ManualActionSuggestion;
  claim: ManualActionSuggestion;
  claimRemint: ManualActionSuggestion & { defaultTermDays: number };
};

export type ManualActionSuggestion = {
  count: number;
  enabled: boolean;
  idStart: number | null;
  idEnd: number | null;
  idRanges: string[];
};

export type DashboardRecordRow = {
  sheet: string;
  wallet: string;
  rowNumber: number;
  label: string;
  baseLabel: string;
  remintRound: number;
  quantity: number;
  status: MintRecord["status"];
  expiryDate: string | null;
  termDays: number | null;
  daysUntilExpiry: number | null;
  unlockTime: string | null;
  minutesUntilUnlock: number | null;
  source: "sheet" | "chain";
  rankStart: number | null;
  rankEnd: number | null;
  tableRemintRound: number;
  chainRemintRound: number | null;
  remintRoundMismatch: boolean;
};

export function buildDashboardData(rows: WorkbookRow[], options: DashboardOptions): DashboardData {
  const dueSoonDays = options.dueSoonDays ?? 14;
  const claimBatchSize = options.claimBatchSize ?? 100;
  const plannedMintBatchSize = options.plannedMintBatchSize ?? 50;
  const maxBatchSize = Math.max(claimBatchSize, plannedMintBatchSize);
  const classification = classifyWorkbookRows(rows, { today: options.today });
  const queueItems = buildQueueItems(classification.records, { claimBatchSize, plannedMintBatchSize });
  const records = classification.records;
  const chainMintStatuses = options.chainMintStatuses ?? [];
  const nowTs = options.nowTs ?? Math.floor(Date.now() / 1000);
  const walletRows = buildWalletRows(
    records,
    queueItems,
    classification.needsReview,
    options.chainMintCounts ?? [],
    chainMintStatuses,
    { claimBatchSize, plannedMintBatchSize },
  );
  const chainRowsEnabled = chainMintStatuses.length > 0;
  const chainClaimableRows = chainMintStatuses
    .filter((status) => status.status === "claimable")
    .map((status) => toChainDashboardRecord(status, nowTs, options.chainHistory))
    .sort(recordSort);
  const chainDueSoonRows = chainMintStatuses
    .filter((status) => isChainDueSoon(status, nowTs, dueSoonDays))
    .map((status) => toChainDashboardRecord(status, nowTs, options.chainHistory))
    .sort(recordSort);
  const allMintRows = chainRowsEnabled
    ? chainMintStatuses
      .map((status) => toChainDashboardRecord(status, nowTs, options.chainHistory))
      .sort(recordIdSort)
    : records
      .filter((record) => record.status === "claimable" || record.status === "active_mint")
      .map((record) => toDashboardRecord(record, options.today))
      .sort(recordIdSort);

  return {
    metadata: {
      sourcePath: options.sourcePath ?? null,
      today: options.today,
      generatedAt: options.generatedAt ?? new Date().toISOString(),
      dueSoonDays,
      maxBatchSize,
      claimBatchSize,
      plannedMintBatchSize,
      maxMintTermDays: options.maxMintTermDays ?? DEFAULT_MAX_MINT_TERM_DAYS,
      readOnly: true,
    },
    summary: {
      activeMint: sumRecords(records, "active_mint"),
      claimable: chainRowsEnabled ? sumDashboardRecords(chainClaimableRows) : sumRecords(records, "claimable"),
      claimed: sumRecords(records, "claimed"),
      plannedMint: sumRecords(records, "planned_mint"),
      needsReview: classification.needsReview.reduce((sum, item) => sum + (item.rangeCount ?? item.quantity ?? 0), 0),
      queuedClaimRemint: chainRowsEnabled ? sumDashboardRecords(chainClaimableRows) : sumQueue(queueItems, "claim_remint"),
      queuedPlannedMint: sumQueue(queueItems, "planned_mint"),
      queueChunks: queueItems.length,
      wallets: walletRows.length,
      chainCheckedWallets: walletRows.filter((row) => row.chainStatus !== "unchecked").length,
      chainMismatchedWallets: walletRows.filter((row) => row.chainStatus === "ok" && row.chainDelta !== 0).length,
    },
    wallets: walletRows,
    claimable: chainRowsEnabled ? chainClaimableRows : records
      .filter((record) => record.status === "claimable")
      .map((record) => toDashboardRecord(record, options.today))
      .sort(recordSort),
    dueSoon: chainRowsEnabled ? chainDueSoonRows : records
      .filter((record) => record.status === "active_mint")
      .map((record) => toDashboardRecord(record, options.today))
      .filter((record) => record.daysUntilExpiry != null && record.daysUntilExpiry >= 0 && record.daysUntilExpiry <= dueSoonDays)
      .sort(recordSort),
    allMint: allMintRows,
    plannedMint: records
      .filter((record) => record.status === "planned_mint")
      .map((record) => toDashboardRecord(record, options.today))
      .sort((a, b) => a.sheet.localeCompare(b.sheet) || a.rowNumber - b.rowNumber),
    reviews: classification.needsReview,
  };
}

function sumRecords(records: MintRecord[], status: MintRecord["status"]): number {
  return records
    .filter((record) => record.status === status)
    .reduce((sum, record) => sum + record.quantity, 0);
}

function sumQueue(queueItems: QueueItem[], kind: QueueItem["kind"]): number {
  return queueItems
    .filter((item) => item.kind === kind)
    .reduce((sum, item) => sum + item.ids.length, 0);
}

function sumDashboardRecords(records: DashboardRecordRow[]): number {
  return records.reduce((sum, record) => sum + record.quantity, 0);
}

function buildWalletRows(
  records: MintRecord[],
  queueItems: QueueItem[],
  reviews: ReviewItem[],
  chainMintCounts: ChainMintCount[],
  chainMintStatuses: ChainMintStatus[],
  batchOptions: { claimBatchSize: number; plannedMintBatchSize: number },
): WalletDashboardRow[] {
  const byWallet = new Map<string, WalletDashboardRow>();
  for (const record of records) {
    const row = walletRow(byWallet, record.sheet, record.wallet);
    addStatusQuantity(row, record.status, record.quantity);
    if (record.status !== "planned_mint") {
      row.sheetMintedIds = countUniqueRanges([...rowRanges.get(row) ?? [], ...record.ranges]);
      rowRanges.set(row, [...rowRanges.get(row) ?? [], ...record.ranges]);
    }
    if (record.status === "active_mint" && record.expiryDate) {
      row.nextExpiryDate = minDate(row.nextExpiryDate, record.expiryDate);
    }
  }
  for (const item of queueItems) {
    const row = walletRow(byWallet, item.sheet, item.wallet);
    if (item.kind === "claim_remint") {
      row.queuedClaimRemint += item.ids.length;
    } else {
      row.queuedPlannedMint += item.ids.length;
    }
  }
  for (const review of reviews) {
    const row = walletRow(byWallet, review.sheet, review.wallet);
    row.needsReview += review.rangeCount ?? review.quantity ?? 0;
  }
  if (chainMintStatuses.length > 0) {
    applyChainMintStatuses(byWallet, chainMintStatuses);
  }
  applyManualActions(byWallet, queueItems, chainMintStatuses, batchOptions);
  applyChainCounts(byWallet, chainMintCounts);
  return [...byWallet.values()].sort(walletRowSort);
}

function walletRow(map: Map<string, WalletDashboardRow>, sheet: string, wallet: string): WalletDashboardRow {
  const key = `${sheet}:${wallet.toLowerCase()}`;
  const existing = map.get(key);
  if (existing) {
    return existing;
  }
  const row: WalletDashboardRow = {
    sheet,
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
    sheetMintedIds: 0,
    chainMinted: null,
    chainDelta: null,
    chainStatus: "unchecked",
    chainError: null,
    manualActions: emptyManualActions(),
  };
  map.set(key, row);
  return row;
}

function applyManualActions(
  map: Map<string, WalletDashboardRow>,
  queueItems: QueueItem[],
  chainMintStatuses: ChainMintStatus[],
  batchOptions: { claimBatchSize: number; plannedMintBatchSize: number },
): void {
  const firstBatches = firstQueueBatches(queueItems);
  const firstChainBatches = firstChainClaimBatches(chainMintStatuses);
  for (const row of map.values()) {
    const key = walletKey(row.sheet, row.wallet);
    const firstClaimBatch = firstBatches.get(key)?.claim_remint ?? null;
    const firstChainClaimBatch = firstChainBatches.get(key) ?? null;
    const firstMintBatch = firstBatches.get(key)?.planned_mint ?? null;
    const mintCount = firstMintBatch?.ids.length ?? Math.min(batchOptions.plannedMintBatchSize, row.queuedPlannedMint);
    const claimCount = firstChainClaimBatch?.quantity ?? firstClaimBatch?.ids.length ?? Math.min(batchOptions.claimBatchSize, row.claimable);
    const claimRemintCount = firstChainClaimBatch?.quantity ?? firstClaimBatch?.ids.length ?? Math.min(batchOptions.claimBatchSize, row.queuedClaimRemint);
    row.manualActions = {
      mint: actionSuggestion(mintCount, firstMintBatch),
      claim: firstChainClaimBatch ? actionSuggestionFromChain(firstChainClaimBatch) : actionSuggestion(claimCount, firstClaimBatch),
      claimRemint: {
        ...(firstChainClaimBatch ? actionSuggestionFromChain(firstChainClaimBatch) : actionSuggestion(claimRemintCount, firstClaimBatch)),
        defaultTermDays: DEFAULT_REMINT_TERM_DAYS,
      },
    };
  }
}

function emptyManualActions(): WalletManualActions {
  return {
    mint: emptyManualAction(),
    claim: emptyManualAction(),
    claimRemint: { ...emptyManualAction(), defaultTermDays: DEFAULT_REMINT_TERM_DAYS },
  };
}

function emptyManualAction(): ManualActionSuggestion {
  return { count: 0, enabled: false, idStart: null, idEnd: null, idRanges: [] };
}

function firstQueueBatches(queueItems: QueueItem[]): Map<string, Partial<Record<QueueItem["kind"], QueueItem>>> {
  const batches = new Map<string, Partial<Record<QueueItem["kind"], QueueItem>>>();
  for (const item of queueItems) {
    const key = walletKey(item.sheet, item.wallet);
    const walletBatches = batches.get(key) ?? {};
    if (!walletBatches[item.kind]) {
      walletBatches[item.kind] = item;
      batches.set(key, walletBatches);
    }
  }
  return batches;
}

function firstChainClaimBatches(chainMintStatuses: ChainMintStatus[]): Map<string, ChainMintStatus & { quantity: number }> {
  const batches = new Map<string, ChainMintStatus & { quantity: number }>();
  const sorted = chainMintStatuses
    .filter((status) => status.status === "claimable")
    .sort((a, b) => (
      (a.maturityTs ?? Number.MAX_SAFE_INTEGER) - (b.maturityTs ?? Number.MAX_SAFE_INTEGER) ||
      a.sheet.localeCompare(b.sheet) ||
      a.idStart - b.idStart
    ));
  for (const status of sorted) {
    const key = walletKey(status.sheet, status.wallet);
    if (!batches.has(key)) {
      batches.set(key, { ...status, quantity: status.idEnd - status.idStart + 1 });
    }
  }
  return batches;
}

function walletKey(sheet: string, wallet: string): string {
  return `${sheet}:${wallet.toLowerCase()}`;
}

function actionSuggestion(count: number, batch: QueueItem | null): ManualActionSuggestion {
  const ids = batch?.ids ?? [];
  return {
    count,
    enabled: count > 0,
    idStart: ids[0] ?? null,
    idEnd: ids.at(-1) ?? null,
    idRanges: idsToRangeLabels(ids),
  };
}

function actionSuggestionFromChain(status: ChainMintStatus & { quantity: number }): ManualActionSuggestion {
  return {
    count: status.quantity,
    enabled: status.quantity > 0,
    idStart: status.idStart,
    idEnd: status.idEnd,
    idRanges: [formatIdRange(status.idStart, status.idEnd)],
  };
}

function idsToRangeLabels(ids: number[]): string[] {
  if (ids.length === 0) {
    return [];
  }
  const ranges: string[] = [];
  let start = ids[0];
  let previous = ids[0];
  for (const id of ids.slice(1)) {
    if (id === previous + 1) {
      previous = id;
      continue;
    }
    ranges.push(formatIdRange(start, previous));
    start = id;
    previous = id;
  }
  ranges.push(formatIdRange(start, previous));
  return ranges;
}

function formatIdRange(start: number, end: number): string {
  return start === end ? String(start) : `${start}-${end}`;
}

function applyChainCounts(map: Map<string, WalletDashboardRow>, chainMintCounts: ChainMintCount[]): void {
  for (const chain of chainMintCounts) {
    for (const row of map.values()) {
      if (row.wallet.toLowerCase() !== chain.wallet.toLowerCase()) {
        continue;
      }
      row.chainStatus = chain.status;
      row.chainError = chain.error ?? row.chainError;
      if (chain.status === "ok" && chain.count != null) {
        row.chainMinted = chain.count;
        row.chainDelta = chain.count - row.sheetMintedIds;
      }
    }
  }
}

function applyChainMintStatuses(map: Map<string, WalletDashboardRow>, chainMintStatuses: ChainMintStatus[]): void {
  const affected = new Set(chainMintStatuses.map((status) => walletKey(status.sheet, status.wallet)));
  for (const row of map.values()) {
    if (!affected.has(walletKey(row.sheet, row.wallet))) {
      continue;
    }
    row.claimable = 0;
    row.queuedClaimRemint = 0;
    row.nextExpiryDate = null;
    row.nextUnlockTime = null;
    row.nextUnlockQuantity = 0;
  }
  const statusErrorsByWallet = new Map<string, string>();
  for (const status of chainMintStatuses) {
    const row = walletRow(map, status.sheet, status.wallet);
    if (status.status === "error" && status.error && !statusErrorsByWallet.has(walletKey(status.sheet, status.wallet))) {
      statusErrorsByWallet.set(walletKey(status.sheet, status.wallet), status.error);
    }
    const quantity = status.idEnd - status.idStart + 1;
    if (status.status === "claimable") {
      row.claimable += quantity;
      row.queuedClaimRemint += quantity;
    } else if (status.status === "active" && status.unlockTime) {
      row.nextExpiryDate = minDate(row.nextExpiryDate, status.unlockTime.slice(0, 10));
    }
    if ((status.status === "claimable" || status.status === "active") && status.unlockTime) {
      addNextUnlock(row, status.unlockTime, quantity);
    }
  }
  for (const row of map.values()) {
    if (row.nextUnlockTime == null) {
      row.chainError = statusErrorsByWallet.get(walletKey(row.sheet, row.wallet)) ?? row.chainError;
    }
  }
}

function addNextUnlock(row: WalletDashboardRow, unlockTime: string, quantity: number): void {
  const unlockDay = localDateKeyFromIso(unlockTime);
  const currentDay = row.nextUnlockTime == null ? null : localDateKeyFromIso(row.nextUnlockTime);
  if (row.nextUnlockTime == null || (currentDay != null && unlockDay < currentDay)) {
    row.nextUnlockTime = unlockTime;
    row.nextUnlockQuantity = quantity;
    row.nextExpiryDate = unlockDay;
    return;
  }
  if (unlockDay === currentDay) {
    row.nextUnlockQuantity += quantity;
    if (unlockTime < row.nextUnlockTime) {
      row.nextUnlockTime = unlockTime;
    }
  }
}

function walletRowSort(a: WalletDashboardRow, b: WalletDashboardRow): number {
  return (
    (a.nextUnlockTime ?? a.nextExpiryDate ?? "9999-12-31T23:59:59.999Z")
      .localeCompare(b.nextUnlockTime ?? b.nextExpiryDate ?? "9999-12-31T23:59:59.999Z") ||
    a.sheet.localeCompare(b.sheet)
  );
}

const rowRanges = new WeakMap<WalletDashboardRow, Range[]>();

function countUniqueRanges(ranges: Range[]): number {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  let total = 0;
  let currentStart: number | null = null;
  let currentEnd: number | null = null;
  for (const range of sorted) {
    if (currentStart == null || currentEnd == null) {
      currentStart = range.start;
      currentEnd = range.end;
      continue;
    }
    if (range.start <= currentEnd + 1) {
      currentEnd = Math.max(currentEnd, range.end);
      continue;
    }
    total += currentEnd - currentStart + 1;
    currentStart = range.start;
    currentEnd = range.end;
  }
  if (currentStart != null && currentEnd != null) {
    total += currentEnd - currentStart + 1;
  }
  return total;
}

function addStatusQuantity(row: WalletDashboardRow, status: MintRecord["status"], quantity: number): void {
  if (status === "active_mint") {
    row.activeMint += quantity;
  } else if (status === "claimable") {
    row.claimable += quantity;
  } else if (status === "claimed") {
    row.claimed += quantity;
  } else {
    row.plannedMint += quantity;
  }
}

function toDashboardRecord(record: MintRecord, today: string): DashboardRecordRow {
  const daysUntilExpiry = record.expiryDate == null ? null : daysBetween(today, record.expiryDate);
  return {
    sheet: record.sheet,
    wallet: record.wallet,
    rowNumber: record.rowNumber,
    label: record.label,
    baseLabel: record.baseLabel ?? record.label,
    remintRound: record.remintRound ?? 0,
    quantity: record.quantity,
    status: record.status,
    expiryDate: record.expiryDate,
    termDays: record.termDays ?? (record.status === "planned_mint" ? daysUntilExpiry : null),
    daysUntilExpiry,
    unlockTime: null,
    minutesUntilUnlock: null,
    source: "sheet",
    rankStart: null,
    rankEnd: null,
    tableRemintRound: record.remintRound ?? 0,
    chainRemintRound: null,
    remintRoundMismatch: false,
  };
}

function toChainDashboardRecord(
  status: ChainMintStatus,
  nowTs: number,
  chainHistory?: CoinToolHistoryIndex,
): DashboardRecordRow {
  const quantity = status.idEnd - status.idStart + 1;
  const tableRemintRound = status.remintRound ?? 0;
  const chainRemintRound = chainHistory?.rangeRemintRound(status.wallet, status.idStart, status.idEnd) ?? null;
  const baseLabel = status.baseLabel ?? formatIdRange(status.idStart, status.idEnd);
  const label = status.label && status.label !== baseLabel
    ? status.label
    : prefixedRangeLabel(chainRemintRound ?? tableRemintRound, status.idStart, status.idEnd);
  return {
    sheet: status.sheet,
    wallet: status.wallet,
    rowNumber: status.rowNumber,
    label,
    baseLabel,
    remintRound: status.remintRound ?? 0,
    quantity,
    status: status.status === "claimable" ? "claimable" : "active_mint",
    expiryDate: status.unlockTime?.slice(0, 10) ?? null,
    termDays: status.term,
    daysUntilExpiry: status.maturityTs == null ? null : Math.floor((status.maturityTs - nowTs) / (24 * 60 * 60)),
    unlockTime: status.unlockTime,
    minutesUntilUnlock: status.maturityTs == null ? null : Math.floor((status.maturityTs - nowTs) / 60),
    source: "chain",
    rankStart: status.rank,
    rankEnd: status.rank == null ? null : status.rank + quantity - 1,
    tableRemintRound,
    chainRemintRound,
    remintRoundMismatch: chainRemintRound != null && chainRemintRound !== tableRemintRound,
  };
}

function prefixedRangeLabel(remintRound: number, start: number, end: number): string {
  const range = formatIdRange(start, end);
  return remintRound > 0 ? `${"F".repeat(remintRound)} ${range}` : range;
}

function isChainDueSoon(status: ChainMintStatus, nowTs: number, dueSoonDays: number): boolean {
  if (status.status !== "active" || status.maturityTs == null) {
    return false;
  }
  const secondsUntilUnlock = status.maturityTs - nowTs;
  return secondsUntilUnlock >= 0 && secondsUntilUnlock <= dueSoonDays * 24 * 60 * 60;
}

function daysBetween(start: string, end: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / msPerDay);
}

function recordSort(a: DashboardRecordRow, b: DashboardRecordRow): number {
  return (
    (a.expiryDate ?? "9999-12-31").localeCompare(b.expiryDate ?? "9999-12-31") ||
    a.sheet.localeCompare(b.sheet) ||
    a.rowNumber - b.rowNumber
  );
}

function recordIdSort(a: DashboardRecordRow, b: DashboardRecordRow): number {
  const aRange = firstIdFromLabel(a.baseLabel ?? a.label);
  const bRange = firstIdFromLabel(b.baseLabel ?? b.label);
  return (
    a.sheet.localeCompare(b.sheet) ||
    a.wallet.localeCompare(b.wallet) ||
    aRange - bRange ||
    a.rowNumber - b.rowNumber
  );
}

function firstIdFromLabel(label: string): number {
  const match = label.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
}

function minDate(current: string | null, next: string): string {
  return current == null || next < current ? next : current;
}

function localDateKeyFromIso(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
