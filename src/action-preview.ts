import { classifyWorkbookRows } from "./importer.ts";
import { COINTOOL_BATCH_MINTER, DEFAULT_COINTOOL_SALT_HEX, type ChainMintStatus } from "./chain.ts";
import type { MintRecord, WorkbookRow } from "./models.ts";
import { buildQueueItems } from "./queue.ts";
import { buildClaimCalldata, buildClaimRemintCalldata, buildMintCalldata } from "./template.ts";

const DEFAULT_CLAIM_REMINT_TARGET = "0xc7ba94123464105a42f0f6c4093f0b16a5ce5c98";
const DEFAULT_CLAIM_REMINT_INNER_SELECTOR = "0x68154343";
const DEFAULT_OPERATION_CHAIN_ID = 1;

export type MintPreviewOptions = {
  sheet: string;
  wallet?: string;
  today: string;
  plannedMintBatchSize?: number;
  plannedCount?: number;
  skipPlannedIds?: number;
  chainMinted?: number;
  startId?: number;
  termDays?: number;
  chainId?: number;
  saltHex?: string;
};

export type MintPreviewTransaction = {
  index: number;
  count: number;
  ids: number[];
  idStart: number;
  idEnd: number;
  operationId: string;
  functionName: "mint";
  chainId: number;
  contractAddress: string;
  termDays: number;
  to: string;
  value: "0x0";
  data: string;
};

export type MintPreview = {
  kind: "mint";
  sheet: string;
  wallet: string;
  to: string;
  value: "0x0";
  data: string;
  ids: number[];
  count: number;
  plannedCount: number;
  transactionCount: number;
  idStart: number;
  idEnd: number;
  termDays: number;
  expiryDate: string | null;
  saltHex: string;
  transactions: MintPreviewTransaction[];
};

export type ClaimRemintPreviewOptions = {
  sheet: string;
  termDays: number;
  claimBatchSize?: number;
  selectedBatches?: Array<{
    rowNumber: number;
    idStart: number;
    idEnd: number;
  }>;
  saltHex?: string;
  target?: string;
  innerSelector?: string;
  today: string;
  chainId?: number;
};

export type ClaimPreviewOptions = {
  sheet: string;
  claimBatchSize?: number;
  selectedBatches?: Array<{
    rowNumber: number;
    idStart: number;
    idEnd: number;
  }>;
  saltHex?: string;
  today: string;
  chainId?: number;
};

export type ClaimRemintPreviewTransaction = {
  index: number;
  count: number;
  ids: number[];
  idStart: number;
  idEnd: number;
  idRanges: string[];
  operationId: string;
  functionName: "claim" | "claim_remint";
  chainId: number;
  contractAddress: string;
  termDays: number;
  expectedXenLogCount: number;
  to: string;
  value: "0x0";
  data: string;
};

export type ClaimRemintPreview = {
  kind: "claim_remint";
  sheet: string;
  wallet: string;
  to: string;
  value: "0x0";
  data: string;
  ids: number[];
  count: number;
  transactionCount: number;
  idStart: number;
  idEnd: number;
  termDays: number;
  expiryDate: string | null;
  saltHex: string;
  transactions: ClaimRemintPreviewTransaction[];
};

export type ClaimPreview = {
  kind: "claim";
  sheet: string;
  wallet: string;
  to: string;
  value: "0x0";
  data: string;
  ids: number[];
  count: number;
  transactionCount: number;
  idStart: number;
  idEnd: number;
  saltHex: string;
  transactions: ClaimRemintPreviewTransaction[];
};

export function buildMintPreview(rows: WorkbookRow[], options: MintPreviewOptions): MintPreview {
  const plannedMintBatchSize = options.plannedMintBatchSize ?? 50;
  if (options.wallet || options.startId != null) {
    return buildManualMintPreview(options, plannedMintBatchSize);
  }
  const classification = classifyWorkbookRows(rows, { today: options.today });
  const queueItems = buildQueueItems(classification.records, { plannedMintBatchSize, claimBatchSize: 100 });
  const items = queueItems.filter((queueItem) => queueItem.kind === "planned_mint" && queueItem.sheet === options.sheet);
  const catchUp = buildChainCatchUpMintPlan(classification.records, options);
  if (items.length === 0 && catchUp.ids.length === 0) {
    throw new Error(`No planned mint queue found for ${options.sheet}`);
  }
  const allPlannedIds = items.flatMap((queueItem) => queueItem.ids);
  const skipPlannedIds = options.skipPlannedIds ?? 0;
  if (!Number.isSafeInteger(skipPlannedIds) || skipPlannedIds < 0) {
    throw new Error("skipPlannedIds must be a non-negative integer");
  }
  if (catchUp.ids.length === 0 && skipPlannedIds >= allPlannedIds.length) {
    throw new Error(`skipPlannedIds ${skipPlannedIds} exhausts planned mint queue ${allPlannedIds.length}`);
  }
  const availableIds = [...catchUp.ids, ...allPlannedIds.slice(skipPlannedIds)];
  const plannedCount = options.plannedCount ?? Math.min(plannedMintBatchSize, availableIds.length);
  if (!Number.isSafeInteger(plannedCount) || plannedCount <= 0) {
    throw new Error("plannedCount must be a positive integer");
  }
  if (plannedCount > availableIds.length) {
    throw new Error(`plannedCount ${plannedCount} exceeds planned mint queue ${availableIds.length}`);
  }
  const ids = availableIds.slice(0, plannedCount);
  const firstItem = items[0];
  const record = catchUp.record ?? classification.records.find((candidate) => candidate.id === firstItem?.recordId);
  if (!record) {
    throw new Error(`Missing planned mint record for ${options.sheet}`);
  }
  const termDays = options.termDays ?? (catchUp.record ? termDaysFromExpiry(options.today, record.expiryDate) : record.termDays ?? termDaysFromExpiry(options.today, record.expiryDate));
  if (!Number.isSafeInteger(termDays) || termDays <= 0) {
    throw new Error("termDays must be a positive integer");
  }
  const saltHex = options.saltHex ?? DEFAULT_COINTOOL_SALT_HEX;
  const chainId = options.chainId ?? DEFAULT_OPERATION_CHAIN_ID;
  const wallet = catchUp.wallet ?? firstItem!.wallet;
  const transactions = buildMintTransactions(ids, plannedMintBatchSize, termDays, saltHex, wallet, chainId);
  return {
    kind: "mint",
    sheet: options.sheet,
    wallet,
    to: COINTOOL_BATCH_MINTER,
    value: "0x0",
    data: transactions[0].data,
    ids,
    count: transactions[0].count,
    plannedCount,
    transactionCount: transactions.length,
    idStart: ids[0],
    idEnd: ids.at(-1)!,
    termDays,
    expiryDate: addDays(options.today, termDays),
    saltHex,
    transactions,
  };
}

function buildManualMintPreview(options: MintPreviewOptions, plannedMintBatchSize: number): MintPreview {
  if (!options.wallet) {
    throw new Error("wallet is required for manual mint preview");
  }
  if (!Number.isSafeInteger(options.startId) || options.startId <= 0) {
    throw new Error("startId must be a positive integer");
  }
  if (!Number.isSafeInteger(options.plannedCount) || options.plannedCount <= 0) {
    throw new Error("plannedCount must be a positive integer");
  }
  if (!Number.isSafeInteger(options.termDays) || options.termDays <= 0) {
    throw new Error("termDays must be a positive integer");
  }
  const ids = rangeIds(options.startId, options.startId + options.plannedCount - 1);
  const saltHex = options.saltHex ?? DEFAULT_COINTOOL_SALT_HEX;
  const chainId = options.chainId ?? DEFAULT_OPERATION_CHAIN_ID;
  const transactions = buildMintTransactions(ids, plannedMintBatchSize, options.termDays, saltHex, options.wallet, chainId);
  return {
    kind: "mint",
    sheet: options.sheet,
    wallet: options.wallet,
    to: COINTOOL_BATCH_MINTER,
    value: "0x0",
    data: transactions[0].data,
    ids,
    count: transactions[0].count,
    plannedCount: options.plannedCount,
    transactionCount: transactions.length,
    idStart: ids[0],
    idEnd: ids.at(-1)!,
    termDays: options.termDays,
    expiryDate: addDays(options.today, options.termDays),
    saltHex,
    transactions,
  };
}

function buildMintTransactions(
  ids: number[],
  plannedMintBatchSize: number,
  termDays: number,
  saltHex: string,
  wallet: string,
  chainId: number,
): MintPreviewTransaction[] {
  return chunkIds(ids, plannedMintBatchSize).map((transactionIds, index) => {
    const idStart = transactionIds[0];
    const idEnd = transactionIds.at(-1)!;
    return {
      index: index + 1,
      count: transactionIds.length,
      ids: transactionIds,
      idStart,
      idEnd,
      operationId: buildOperationId({
        chainId,
        wallet,
        functionName: "mint",
        idStart,
        idEnd,
        termDays,
        chunkIndex: index + 1,
      }),
      functionName: "mint",
      chainId,
      contractAddress: COINTOOL_BATCH_MINTER,
      termDays,
      to: COINTOOL_BATCH_MINTER,
      value: "0x0" as const,
      data: buildMintCalldata({
        total: transactionIds.length,
        termDays,
        saltHex,
      }),
    };
  });
}

function buildChainCatchUpMintPlan(
  records: MintRecord[],
  options: MintPreviewOptions,
): { ids: number[]; record: MintRecord | null; wallet: string | null } {
  if (options.chainMinted == null) {
    return { ids: [], record: null, wallet: null };
  }
  if (!Number.isSafeInteger(options.chainMinted) || options.chainMinted < 0) {
    throw new Error("chainMinted must be a non-negative integer");
  }
  const rows: Array<{ id: number; record: MintRecord }> = [];
  for (const record of records) {
    if (record.sheet !== options.sheet || record.status !== "active_mint") {
      continue;
    }
    for (const range of record.ranges) {
      const start = Math.max(range.start, options.chainMinted + 1);
      if (start > range.end) {
        continue;
      }
      for (const id of rangeIds(start, range.end)) {
        rows.push({ id, record });
      }
    }
  }
  rows.sort((a, b) => a.id - b.id);
  if (rows.length === 0) {
    return { ids: [], record: null, wallet: null };
  }
  return {
    ids: rows.map((row) => row.id),
    record: rows[0].record,
    wallet: rows[0].record.wallet,
  };
}

export function buildClaimRemintPreview(
  chainStatuses: ChainMintStatus[],
  options: ClaimRemintPreviewOptions,
): ClaimRemintPreview {
  const claimBatchSize = options.claimBatchSize ?? 100;
  if (!Number.isSafeInteger(options.termDays) || options.termDays <= 0) {
    throw new Error("termDays must be a positive integer");
  }
  const selectedBatches = options.selectedBatches ?? [];
  const claimableRows = chainStatuses
    .filter((status) => status.sheet === options.sheet && status.status === "claimable")
    .sort((a, b) => a.idStart - b.idStart);
  const rows = selectedBatches.length > 0
    ? selectClaimableRows(claimableRows, selectedBatches)
    : claimableRows;
  if (rows.length === 0) {
    throw new Error(`No chain-claimable XEN batches found for ${options.sheet}`);
  }
  const wallet = rows[0].wallet;
  if (rows.some((row) => row.wallet.toLowerCase() !== wallet.toLowerCase())) {
    throw new Error(`Claimable batches for ${options.sheet} contain multiple wallets`);
  }
  const groups = groupClaimRows(rows, claimBatchSize);
  const ids = groups.flatMap((group) => group.ids);
  const saltHex = options.saltHex ?? DEFAULT_COINTOOL_SALT_HEX;
  const target = options.target ?? DEFAULT_CLAIM_REMINT_TARGET;
  const innerSelector = options.innerSelector ?? DEFAULT_CLAIM_REMINT_INNER_SELECTOR;
  const chainId = options.chainId ?? DEFAULT_OPERATION_CHAIN_ID;
  const transactions = groups.map((group, index) => {
    const idStart = group.ids[0];
    const idEnd = group.ids.at(-1)!;
    return {
      index: index + 1,
      count: group.ids.length,
      ids: group.ids,
      idStart,
      idEnd,
      idRanges: group.idRanges,
      operationId: buildOperationId({
        chainId,
        wallet,
        functionName: "claim_remint",
        idStart,
        idEnd,
        termDays: options.termDays,
        chunkIndex: index + 1,
      }),
      functionName: "claim_remint" as const,
      chainId,
      contractAddress: COINTOOL_BATCH_MINTER,
      termDays: options.termDays,
      expectedXenLogCount: group.ids.length,
      to: COINTOOL_BATCH_MINTER,
      value: "0x0" as const,
      data: buildClaimRemintCalldata({
        ids: group.ids,
        wallet,
        termDays: options.termDays,
        target,
        innerSelector,
        saltHex,
      }),
    };
  });
  return {
    kind: "claim_remint",
    sheet: options.sheet,
    wallet,
    to: COINTOOL_BATCH_MINTER,
    value: "0x0",
    data: transactions[0].data,
    ids,
    count: ids.length,
    transactionCount: transactions.length,
    idStart: ids[0],
    idEnd: ids.at(-1)!,
    termDays: options.termDays,
    expiryDate: addDays(options.today, options.termDays),
    saltHex,
    transactions,
  };
}

export function buildClaimPreview(
  chainStatuses: ChainMintStatus[],
  options: ClaimPreviewOptions,
): ClaimPreview {
  const claimBatchSize = options.claimBatchSize ?? 100;
  const rows = selectedClaimableRowsForPreview(chainStatuses, options);
  const wallet = rows[0].wallet;
  if (rows.some((row) => row.wallet.toLowerCase() !== wallet.toLowerCase())) {
    throw new Error(`Claimable batches for ${options.sheet} contain multiple wallets`);
  }
  const groups = groupClaimRows(rows, claimBatchSize);
  const ids = groups.flatMap((group) => group.ids);
  const saltHex = options.saltHex ?? DEFAULT_COINTOOL_SALT_HEX;
  const chainId = options.chainId ?? DEFAULT_OPERATION_CHAIN_ID;
  const transactions = groups.map((group, index) => {
    const idStart = group.ids[0];
    const idEnd = group.ids.at(-1)!;
    return {
      index: index + 1,
      count: group.ids.length,
      ids: group.ids,
      idStart,
      idEnd,
      idRanges: group.idRanges,
      operationId: buildOperationId({
        chainId,
        wallet,
        functionName: "claim",
        idStart,
        idEnd,
        termDays: 0,
        chunkIndex: index + 1,
      }),
      functionName: "claim" as const,
      chainId,
      contractAddress: COINTOOL_BATCH_MINTER,
      termDays: 0,
      expectedXenLogCount: group.ids.length,
      to: COINTOOL_BATCH_MINTER,
      value: "0x0" as const,
      data: buildClaimCalldata({
        ids: group.ids,
        saltHex,
      }),
    };
  });
  return {
    kind: "claim",
    sheet: options.sheet,
    wallet,
    to: COINTOOL_BATCH_MINTER,
    value: "0x0",
    data: transactions[0].data,
    ids,
    count: ids.length,
    transactionCount: transactions.length,
    idStart: ids[0],
    idEnd: ids.at(-1)!,
    saltHex,
    transactions,
  };
}

function selectedClaimableRowsForPreview(
  chainStatuses: ChainMintStatus[],
  options: { sheet: string; selectedBatches?: Array<{ rowNumber: number; idStart: number; idEnd: number }> },
): ChainMintStatus[] {
  const selectedBatches = options.selectedBatches ?? [];
  const claimableRows = chainStatuses
    .filter((status) => status.sheet === options.sheet && status.status === "claimable")
    .sort((a, b) => a.idStart - b.idStart);
  const rows = selectedBatches.length > 0
    ? selectClaimableRows(claimableRows, selectedBatches)
    : claimableRows;
  if (rows.length === 0) {
    throw new Error(`No chain-claimable XEN batches found for ${options.sheet}`);
  }
  return rows;
}

function selectClaimableRows(
  rows: ChainMintStatus[],
  selectedBatches: Array<{ rowNumber: number; idStart: number; idEnd: number }>,
): ChainMintStatus[] {
  const selectedRows: ChainMintStatus[] = [];
  for (const row of rows) {
    for (const batch of selectedBatches) {
      const rangesOverlap = batch.idStart <= row.idEnd && batch.idEnd >= row.idStart;
      if (batch.rowNumber !== row.rowNumber && !rangesOverlap) {
        continue;
      }
      const idStart = Math.max(row.idStart, batch.idStart);
      const idEnd = Math.min(row.idEnd, batch.idEnd);
      if (idStart > idEnd) {
        continue;
      }
      selectedRows.push({
        ...row,
        idStart,
        idEnd,
        label: formatIdRange(idStart, idEnd),
        baseLabel: formatIdRange(idStart, idEnd),
      });
    }
  }
  return selectedRows.sort((a, b) => a.idStart - b.idStart);
}

function groupClaimRows(
  rows: ChainMintStatus[],
  maxSize: number,
): Array<{ ids: number[]; idRanges: string[] }> {
  if (!Number.isSafeInteger(maxSize) || maxSize <= 0) {
    throw new Error("claimBatchSize must be a positive integer");
  }
  const groups: Array<{ ids: number[]; idRanges: string[] }> = [];
  let current: { ids: number[]; idRanges: string[] } = { ids: [], idRanges: [] };
  for (const row of rows) {
    let nextId = row.idStart;
    while (nextId <= row.idEnd) {
      if (current.ids.length === maxSize) {
        groups.push(current);
        current = { ids: [], idRanges: [] };
      }
      const remainingSpace = maxSize - current.ids.length;
      const chunkEnd = Math.min(row.idEnd, nextId + remainingSpace - 1);
      current.ids.push(...rangeIds(nextId, chunkEnd));
      current.idRanges.push(formatIdRange(nextId, chunkEnd));
      nextId = chunkEnd + 1;
    }
  }
  if (current.ids.length > 0) {
    groups.push(current);
  }
  return groups;
}

function batchKey(input: { rowNumber: number; idStart: number; idEnd: number }): string {
  return `${input.rowNumber}:${input.idStart}-${input.idEnd}`;
}

function formatIdRange(start: number, end: number): string {
  return start === end ? String(start) : `${start}-${end}`;
}

function buildOperationId(input: {
  chainId: number;
  wallet: string;
  functionName: "mint" | "claim" | "claim_remint";
  idStart: number;
  idEnd: number;
  termDays: number;
  chunkIndex: number;
}): string {
  return [
    input.chainId,
    input.wallet.toLowerCase(),
    COINTOOL_BATCH_MINTER.toLowerCase(),
    input.functionName,
    input.idStart,
    input.idEnd,
    input.termDays,
    input.chunkIndex,
  ].join(":");
}

function termDaysFromExpiry(today: string, expiryDate: string | null): number {
  if (!expiryDate) {
    throw new Error("Cannot build mint transaction without term days or expiry date");
  }
  const msPerDay = 24 * 60 * 60 * 1000;
  const termDays = Math.round((Date.parse(`${expiryDate}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) / msPerDay);
  if (!Number.isFinite(termDays) || termDays <= 0) {
    throw new Error(`Invalid mint term derived from expiry date ${expiryDate}`);
  }
  return termDays;
}

function chunkIds(ids: number[], maxSize: number): number[][] {
  const chunks: number[][] = [];
  for (let index = 0; index < ids.length; index += maxSize) {
    chunks.push(ids.slice(index, index + maxSize));
  }
  return chunks;
}

function rangeIds(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function addDays(today: string, days: number): string {
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
