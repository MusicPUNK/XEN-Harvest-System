import { minDateIso, parseIntLike, parseNumber, parseYyMmDdDates } from "./dates.ts";
import type { MintRecord, ReviewItem, WorkbookRow } from "./models.ts";
import { countRanges, parseRangeLabel } from "./ranges.ts";

export type ClassificationOptions = {
  today: string;
};

export type ClassificationResult = {
  records: MintRecord[];
  needsReview: ReviewItem[];
  summary: Record<string, number>;
};

export function classifyWorkbookRows(
  rows: WorkbookRow[],
  options: ClassificationOptions,
): ClassificationResult {
  const records: MintRecord[] = [];
  const needsReview: ReviewItem[] = [];
  let nextId = 1;

  for (const row of rows) {
    if (isIgnoredSheet(row.sheet)) {
      continue;
    }

    const label = row.label == null ? "" : String(row.label).trim();
    if (!label) {
      continue;
    }

    let parsedLabel;
    try {
      parsedLabel = parseRangeLabel(label);
    } catch (error) {
      needsReview.push(review(row, label, null, null, String((error as Error).message)));
      continue;
    }
    const ranges = parsedLabel.ranges;

    const quantityFloat = parseNumber(row.quantityRaw);
    const recordedQuantity = quantityFloat == null ? null : Math.trunc(quantityFloat);
    const rangeCount = ranges.length === 0 ? null : countRanges(ranges);
    const claimAmount = parseNumber(row.claimAmountRaw);
    const claimed = claimAmount != null && claimAmount > 0;

    if (ranges.length === 0) {
      if (claimed) {
        continue;
      }
      needsReview.push(review(row, label, recordedQuantity, rangeCount, "No proxy id range found"));
      continue;
    }
    const quantity = rangeCount;

    const expiryDates = parseYyMmDdDates(row.expiryRaw);
    const mintDates = parseYyMmDdDates(row.mintDateRaw);
    const expiryDate = minDateIso(expiryDates);
    const mintDate = minDateIso(mintDates);
    const termDays = parseIntLike(row.termDaysRaw);

    let status: MintRecord["status"];
    if (claimed) {
      status = "claimed";
    } else if (isPlannedMintRow(row)) {
      status = "planned_mint";
    } else if (!expiryDate) {
      needsReview.push(review(row, label, quantity, rangeCount, "Missing expiry date"));
      continue;
    } else if (expiryDate <= options.today) {
      status = "claimable";
    } else {
      status = "active_mint";
    }

    records.push({
      id: nextId++,
      sheet: row.sheet,
      rowNumber: row.rowNumber,
      wallet: row.wallet,
      label,
      baseLabel: parsedLabel.baseLabel,
      remintRound: parsedLabel.remintRound,
      ranges,
      rangeCount,
      quantity,
      status,
      mintDate,
      expiryDate,
      termDays,
    });
  }

  return { records, needsReview, summary: summarize(records, needsReview) };
}

function isPlannedMintRow(row: WorkbookRow): boolean {
  return /^X[78]-/.test(row.sheet) && row.mintDateRaw == null && row.termDaysRaw == null;
}

function isIgnoredSheet(sheet: string): boolean {
  const normalized = sheet.toLowerCase();
  return normalized.includes("(old)") || sheet.includes("成本分析");
}

function review(
  row: WorkbookRow,
  label: string,
  quantity: number | null,
  rangeCount: number | null,
  reason: string,
): ReviewItem {
  return {
    sheet: row.sheet,
    rowNumber: row.rowNumber,
    wallet: row.wallet,
    label,
    quantity,
    rangeCount,
    reason,
  };
}

function summarize(records: MintRecord[], needsReview: ReviewItem[]): Record<string, number> {
  const summary: Record<string, number> = {
    active_mint: 0,
    claimable: 0,
    planned_mint: 0,
    claimed: 0,
    needs_review: needsReview.reduce((sum, item) => sum + (item.quantity ?? 0), 0),
  };
  for (const record of records) {
    summary[record.status] += record.quantity;
  }
  return summary;
}
