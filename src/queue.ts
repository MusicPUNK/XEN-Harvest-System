import type { MintRecord, QueueItem } from "./models.ts";
import { chunkIds, expandRanges } from "./ranges.ts";

export type QueueBatchOptions = {
  claimBatchSize?: number;
  plannedMintBatchSize?: number;
};

const DEFAULT_CLAIM_BATCH_SIZE = 100;
const DEFAULT_PLANNED_MINT_BATCH_SIZE = 50;

export function buildQueueItems(records: MintRecord[], options: QueueBatchOptions | number = {}): QueueItem[] {
  const batchOptions = normalizeBatchOptions(options);
  const items: QueueItem[] = [];
  let nextId = 1;

  for (const record of records) {
    const kind =
      record.status === "claimable"
        ? "claim_remint"
        : record.status === "planned_mint"
          ? "planned_mint"
          : null;
    if (!kind) {
      continue;
    }

    const batchSize = kind === "planned_mint" ? batchOptions.plannedMintBatchSize : batchOptions.claimBatchSize;
    for (const ids of chunkIds(expandRanges(record.ranges), batchSize)) {
      items.push({
        id: nextId++,
        recordId: record.id,
        kind,
        sheet: record.sheet,
        rowNumber: record.rowNumber,
        wallet: record.wallet,
        ids,
        status: "queued",
      });
    }
  }

  return items;
}

function normalizeBatchOptions(options: QueueBatchOptions | number): Required<QueueBatchOptions> {
  if (typeof options === "number") {
    return {
      claimBatchSize: options,
      plannedMintBatchSize: options,
    };
  }
  return {
    claimBatchSize: options.claimBatchSize ?? DEFAULT_CLAIM_BATCH_SIZE,
    plannedMintBatchSize: options.plannedMintBatchSize ?? DEFAULT_PLANNED_MINT_BATCH_SIZE,
  };
}
