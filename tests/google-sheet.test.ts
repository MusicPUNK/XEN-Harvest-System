import test from "node:test";
import assert from "node:assert/strict";

import { buildGoogleSheetExportUrl, parseGoogleSheetId } from "../src/google-sheet.ts";

const SAMPLE_SPREADSHEET_ID = "1SamplePublicSheetId234567890";

test("extracts spreadsheet id from a Google Sheets edit url", () => {
  const id = parseGoogleSheetId(
    `https://docs.google.com/spreadsheets/d/${SAMPLE_SPREADSHEET_ID}/edit?gid=1310876918#gid=1310876918`,
  );

  assert.equal(id, SAMPLE_SPREADSHEET_ID);
});

test("accepts a raw spreadsheet id and builds xlsx export url", () => {
  const url = buildGoogleSheetExportUrl(SAMPLE_SPREADSHEET_ID);

  assert.equal(
    url,
    `https://docs.google.com/spreadsheets/d/${SAMPLE_SPREADSHEET_ID}/export?format=xlsx`,
  );
});
