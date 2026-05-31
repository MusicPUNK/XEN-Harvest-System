import type { Range } from "./models.ts";

const RANGE_RE = /(\d+)\s*-\s*(\d+)/g;
const REMINT_PREFIX_RE = /^(F+)\s*(?=\d)/i;

export type ParsedRangeLabel = {
  label: string;
  baseLabel: string;
  remintRound: number;
  ranges: Range[];
};

export function parseRangeCell(value: unknown): Range[] {
  if (value == null) {
    return [];
  }

  const text = String(value).trim();
  if (!text) {
    return [];
  }

  const ranges: Range[] = [];
  for (const match of text.matchAll(RANGE_RE)) {
    const start = Number.parseInt(match[1], 10);
    const end = Number.parseInt(match[2], 10);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start <= 0 || end <= 0) {
      throw new Error(`Invalid range "${match[0]}"`);
    }
    if (end < start) {
      throw new Error(`Invalid range "${match[0]}": end is before start`);
    }
    ranges.push({ start, end });
  }

  return ranges;
}

export function parseRangeLabel(value: unknown): ParsedRangeLabel {
  const label = value == null ? "" : String(value).trim();
  const prefix = label.match(REMINT_PREFIX_RE)?.[1] ?? "";
  const baseLabel = prefix ? label.slice(prefix.length).trim() : label;
  return {
    label,
    baseLabel,
    remintRound: prefix.length,
    ranges: parseRangeCell(baseLabel),
  };
}

export function countRanges(ranges: Range[]): number {
  return ranges.reduce((sum, range) => sum + range.end - range.start + 1, 0);
}

export function expandRanges(ranges: Range[]): number[] {
  const ids: number[] = [];
  for (const range of ranges) {
    for (let id = range.start; id <= range.end; id += 1) {
      ids.push(id);
    }
  }
  return ids;
}

export function chunkIds(ids: number[], maxSize = 80): number[][] {
  if (!Number.isSafeInteger(maxSize) || maxSize <= 0) {
    throw new Error("maxSize must be a positive integer");
  }

  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += maxSize) {
    chunks.push(ids.slice(i, i + maxSize));
  }
  return chunks;
}
