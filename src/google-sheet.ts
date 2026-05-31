import { mkdtempSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readWorkbookRows } from "./excel.ts";
import type { WorkbookRow } from "./models.ts";

export function parseGoogleSheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) {
    return match[1];
  }
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }
  throw new Error("Unable to find Google Sheet id. Paste the full Google Sheet URL or spreadsheet id.");
}

export function buildGoogleSheetExportUrl(input: string): string {
  const id = parseGoogleSheetId(input);
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
}

export async function readGoogleSheetRows(input: string): Promise<WorkbookRow[]> {
  const exportUrl = buildGoogleSheetExportUrl(input);
  const response = await fetch(exportUrl);
  if (!response.ok) {
    throw new Error(
      `Google Sheet export failed: HTTP ${response.status}. Make sure the sheet is readable by link or configure OAuth access.`,
    );
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    throw new Error("Google returned an HTML page instead of XLSX. The sheet likely requires permission.");
  }
  const dir = mkdtempSync(join(tmpdir(), "xen-google-sheet-"));
  const filePath = join(dir, "sheet.xlsx");
  await writeFile(filePath, Buffer.from(await response.arrayBuffer()));
  return readWorkbookRows(filePath);
}
