export type Range = {
  start: number;
  end: number;
};

export type WorkbookRow = {
  sheet: string;
  rowNumber: number;
  wallet: string;
  label: unknown;
  mintDateRaw: unknown;
  termDaysRaw: unknown;
  expiryRaw: unknown;
  quantityRaw: unknown;
  claimAmountRaw: unknown;
};

export type RecordStatus = "claimable" | "active_mint" | "planned_mint" | "claimed";

export type MintRecord = {
  id: number;
  sheet: string;
  rowNumber: number;
  wallet: string;
  label: string;
  baseLabel?: string;
  remintRound?: number;
  ranges: Range[];
  rangeCount: number;
  quantity: number;
  status: RecordStatus;
  mintDate: string | null;
  expiryDate: string | null;
  termDays: number | null;
};

export type ReviewItem = {
  sheet: string;
  rowNumber: number;
  wallet: string;
  label: string;
  quantity: number | null;
  rangeCount: number | null;
  reason: string;
};

export type QueueKind = "claim_remint" | "planned_mint";

export type QueueItem = {
  id: number;
  recordId: number;
  kind: QueueKind;
  sheet: string;
  rowNumber: number;
  wallet: string;
  ids: number[];
  status: "queued";
};
