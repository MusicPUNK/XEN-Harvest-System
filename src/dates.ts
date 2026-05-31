const YYMMDD_RE = /(?<!\d)(\d{6})(?!\d)/g;

export function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.replaceAll(",", "").trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function parseIntLike(value: unknown): number | null {
  const parsed = parseNumber(value);
  return parsed == null ? null : Math.trunc(parsed);
}

export function parseYyMmDdDates(value: unknown): string[] {
  if (value == null || value === "") {
    return [];
  }

  const tokens =
    typeof value === "number" && Number.isInteger(value)
      ? [String(value).padStart(6, "0")]
      : Array.from(String(value).matchAll(YYMMDD_RE), (match) => match[1]);

  const dates: string[] = [];
  for (const token of tokens) {
    const year = 2000 + Number.parseInt(token.slice(0, 2), 10);
    const month = Number.parseInt(token.slice(2, 4), 10);
    const day = Number.parseInt(token.slice(4, 6), 10);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      dates.push(date.toISOString().slice(0, 10));
    }
  }
  return dates;
}

export function minDateIso(dates: string[]): string | null {
  return dates.length === 0 ? null : [...dates].sort()[0];
}
