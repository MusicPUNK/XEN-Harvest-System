import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";

import type { ClassificationResult } from "./importer.ts";
import type { MintRecord, ReviewItem } from "./models.ts";
import { buildQueueItems, type QueueBatchOptions } from "./queue.ts";
import type { DecodedCoinToolF } from "./template.ts";

export function initDb(dbPath: string): void {
  mkdirSync(dirname(dbPath), { recursive: true });
  runSql(
    dbPath,
    `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS wallets (
  address TEXT PRIMARY KEY,
  sheet TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_path TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mint_records (
  id INTEGER PRIMARY KEY,
  wallet TEXT NOT NULL REFERENCES wallets(address),
  sheet TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  label TEXT NOT NULL,
  ranges_json TEXT NOT NULL,
  range_count INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL,
  mint_date TEXT,
  expiry_date TEXT,
  term_days INTEGER,
  source_batch_id INTEGER REFERENCES import_batches(id)
);

CREATE TABLE IF NOT EXISTS review_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet TEXT NOT NULL,
  sheet TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  label TEXT NOT NULL,
  quantity INTEGER,
  range_count INTEGER,
  reason TEXT NOT NULL,
  source_batch_id INTEGER REFERENCES import_batches(id)
);

CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_hash TEXT UNIQUE,
  selector TEXT NOT NULL,
  wallet TEXT,
  term_days INTEGER,
  target TEXT,
  inner_selector TEXT,
  salt_hex TEXT,
  raw_input TEXT NOT NULL,
  decoded_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS queue_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id INTEGER NOT NULL REFERENCES mint_records(id),
  kind TEXT NOT NULL,
  wallet TEXT NOT NULL,
  sheet TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  ids_json TEXT NOT NULL,
  id_start INTEGER NOT NULL,
  id_end INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS nonce_leases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet TEXT NOT NULL,
  nonce INTEGER NOT NULL,
  queue_item_id INTEGER REFERENCES queue_items(id),
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'leased',
  leased_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(wallet, nonce)
);

CREATE TABLE IF NOT EXISTS wallet_runtime (
  wallet TEXT PRIMARY KEY,
  paused INTEGER NOT NULL DEFAULT 0,
  pause_reason TEXT,
  max_pending INTEGER NOT NULL DEFAULT 10,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  wallet TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`,
  );
}

export function insertImportResult(dbPath: string, result: ClassificationResult, sourcePath: string): void {
  initDb(dbPath);
  const sql: string[] = ["BEGIN;", "DELETE FROM queue_items;", "DELETE FROM mint_records;", "DELETE FROM review_items;", "DELETE FROM wallets;"];
  sql.push(`INSERT INTO import_batches (source_path) VALUES (${sqlString(sourcePath)});`);
  sql.push("CREATE TEMP TABLE IF NOT EXISTS _current_batch_id (id INTEGER);");
  sql.push("DELETE FROM _current_batch_id;");
  sql.push("INSERT INTO _current_batch_id SELECT last_insert_rowid();");

  const walletRows = new Map<string, string>();
  for (const record of result.records) {
    walletRows.set(record.wallet.toLowerCase(), record.sheet);
  }
  for (const item of result.needsReview) {
    walletRows.set(item.wallet.toLowerCase(), item.sheet);
  }
  for (const [wallet, sheet] of walletRows) {
    sql.push(`INSERT INTO wallets (address, sheet) VALUES (${sqlString(wallet)}, ${sqlString(sheet)});`);
  }

  for (const record of result.records) {
    sql.push(insertRecordSql(record));
  }
  for (const item of result.needsReview) {
    sql.push(insertReviewSql(item));
  }
  sql.push("COMMIT;");
  runSql(dbPath, sql.join("\n"));
}

export function queueRecords(dbPath: string, options: QueueBatchOptions | number = {}): { inserted: number } {
  initDb(dbPath);
  const records = listRecords(dbPath);
  const queueItems = buildQueueItems(records, options);
  const sql: string[] = ["BEGIN;", "DELETE FROM queue_items;"];
  for (const item of queueItems) {
    sql.push(
      `INSERT INTO queue_items (record_id, kind, wallet, sheet, row_number, ids_json, id_start, id_end, quantity, status)
       VALUES (${item.recordId}, ${sqlString(item.kind)}, ${sqlString(item.wallet.toLowerCase())}, ${sqlString(item.sheet)}, ${item.rowNumber}, ${sqlString(JSON.stringify(item.ids))}, ${item.ids[0]}, ${item.ids.at(-1)}, ${item.ids.length}, 'queued');`,
    );
  }
  sql.push("COMMIT;");
  runSql(dbPath, sql.join("\n"));
  return { inserted: queueItems.length };
}

export function listReviewItems(dbPath: string): ReviewItem[] {
  return queryJson<any>(
    dbPath,
    "SELECT sheet, row_number AS rowNumber, wallet, label, quantity, range_count AS rangeCount, reason FROM review_items ORDER BY sheet, row_number;",
  );
}

export function summarizeDb(dbPath: string): Record<string, number> {
  const statusRows = queryJson<{ status: string; quantity: number }>(
    dbPath,
    "SELECT status, COALESCE(SUM(quantity), 0) AS quantity FROM mint_records GROUP BY status;",
  );
  const reviewRows = queryJson<{ quantity: number }>(
    dbPath,
    "SELECT COALESCE(SUM(quantity), 0) AS quantity FROM review_items;",
  );
  const queueRows = queryJson<{ kind: string; quantity: number }>(
    dbPath,
    "SELECT kind, COALESCE(SUM(quantity), 0) AS quantity FROM queue_items GROUP BY kind;",
  );

  const summary: Record<string, number> = {
    active_mint: 0,
    claimable: 0,
    claimed: 0,
    planned_mint: 0,
    needs_review: reviewRows[0]?.quantity ?? 0,
    queued_claim_remint: 0,
    queued_planned_mint: 0,
  };
  for (const row of statusRows) {
    summary[row.status] = row.quantity;
  }
  for (const row of queueRows) {
    if (row.kind === "claim_remint") {
      summary.queued_claim_remint = row.quantity;
    } else if (row.kind === "planned_mint") {
      summary.queued_planned_mint = row.quantity;
    }
  }
  return summary;
}

export function listQueuedItems(dbPath: string, limit = 20): Array<Record<string, unknown>> {
  return queryJson(
    dbPath,
    `SELECT id, kind, wallet, sheet, row_number AS rowNumber, id_start AS idStart, id_end AS idEnd, quantity, status
     FROM queue_items
     ORDER BY id
     LIMIT ${Number(limit)};`,
  );
}

export function insertDecodedTemplate(
  dbPath: string,
  input: { txHash: string | null; rawInput: string; decoded: DecodedCoinToolF },
): void {
  initDb(dbPath);
  runSql(
    dbPath,
    `INSERT OR REPLACE INTO templates
      (tx_hash, selector, wallet, term_days, target, inner_selector, salt_hex, raw_input, decoded_json)
     VALUES (
      ${sqlNullable(input.txHash)},
      ${sqlString(input.decoded.selector)},
      ${sqlNullable(input.decoded.inner.remintWallet?.toLowerCase() ?? null)},
      ${sqlNullable(input.decoded.inner.remintTermDays)},
      ${sqlString(input.decoded.inner.target.toLowerCase())},
      ${sqlNullable(input.decoded.inner.innerSelector)},
      ${sqlString(input.decoded.saltHex)},
      ${sqlString(input.rawInput)},
      ${sqlString(JSON.stringify(input.decoded))}
     );`,
  );
}

export function listTemplates(dbPath: string): Array<Record<string, unknown>> {
  return queryJson(
    dbPath,
    `SELECT id, tx_hash AS txHash, wallet, term_days AS termDays, target, inner_selector AS innerSelector, salt_hex AS saltHex
     FROM templates
     ORDER BY id;`,
  );
}

function listRecords(dbPath: string): MintRecord[] {
  const rows = queryJson<any>(
    dbPath,
    "SELECT id, sheet, row_number AS rowNumber, wallet, label, ranges_json AS rangesJson, range_count AS rangeCount, quantity, status, mint_date AS mintDate, expiry_date AS expiryDate, term_days AS termDays FROM mint_records ORDER BY id;",
  );
  return rows.map((row) => ({
    id: row.id,
    sheet: row.sheet,
    rowNumber: row.rowNumber,
    wallet: row.wallet,
    label: row.label,
    ranges: JSON.parse(row.rangesJson),
    rangeCount: row.rangeCount,
    quantity: row.quantity,
    status: row.status,
    mintDate: row.mintDate,
    expiryDate: row.expiryDate,
    termDays: row.termDays,
  }));
}

function insertRecordSql(record: MintRecord): string {
  return `INSERT INTO mint_records
    (id, wallet, sheet, row_number, label, ranges_json, range_count, quantity, status, mint_date, expiry_date, term_days, source_batch_id)
    VALUES (${record.id}, ${sqlString(record.wallet.toLowerCase())}, ${sqlString(record.sheet)}, ${record.rowNumber}, ${sqlString(record.label)}, ${sqlString(JSON.stringify(record.ranges))}, ${record.rangeCount}, ${record.quantity}, ${sqlString(record.status)}, ${sqlNullable(record.mintDate)}, ${sqlNullable(record.expiryDate)}, ${sqlNullable(record.termDays)}, (SELECT id FROM _current_batch_id));`;
}

function insertReviewSql(item: ReviewItem): string {
  return `INSERT INTO review_items
    (wallet, sheet, row_number, label, quantity, range_count, reason, source_batch_id)
    VALUES (${sqlString(item.wallet.toLowerCase())}, ${sqlString(item.sheet)}, ${item.rowNumber}, ${sqlString(item.label)}, ${sqlNullable(item.quantity)}, ${sqlNullable(item.rangeCount)}, ${sqlString(item.reason)}, (SELECT id FROM _current_batch_id));`;
}

function runSql(dbPath: string, sql: string): void {
  const result = spawnSync("sqlite3", [dbPath], { input: `PRAGMA busy_timeout=5000;\n${sql}`, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`sqlite3 failed: ${result.stderr || result.stdout}`);
  }
}

function queryJson<T>(dbPath: string, sql: string): T[] {
  const result = spawnSync("sqlite3", ["-json", "-cmd", ".timeout 5000", dbPath, sql], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`sqlite3 query failed: ${result.stderr || result.stdout}`);
  }
  const output = result.stdout.trim();
  return output ? JSON.parse(output) : [];
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlNullable(value: string | number | null): string {
  if (value == null) {
    return "NULL";
  }
  return typeof value === "number" ? String(value) : sqlString(value);
}
