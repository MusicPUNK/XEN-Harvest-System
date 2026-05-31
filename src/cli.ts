import { readFileSync } from "node:fs";

import { insertDecodedTemplate, insertImportResult, listQueuedItems, listReviewItems, listTemplates, queueRecords, summarizeDb } from "./db.ts";
import { readWorkbookRows } from "./excel.ts";
import { classifyWorkbookRows } from "./importer.ts";
import { decodeCoinToolFCalldata, extractRawInputFromEtherscanHtml } from "./template.ts";
import { gasAllowsExecution, getGasSnapshot } from "./gas.ts";
import { sendTelegramAlert } from "./telegram.ts";

const DEFAULT_DB = "data/xen.sqlite";
const DEFAULT_TODAY = new Date().toISOString().slice(0, 10);

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  try {
    switch (command) {
      case "import-excel":
        importExcel(args);
        break;
      case "decode-template":
        await decodeTemplate(args);
        break;
      case "verify":
        verify(args);
        break;
      case "queue":
        queue(args);
        break;
      case "review":
        review(args);
        break;
      case "daemon":
        await daemon(args);
        break;
      case "help":
      case undefined:
        printHelp();
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

function importExcel(args: Record<string, string | boolean>): void {
  const file = requiredString(args.file, "--file");
  const db = stringArg(args.db, DEFAULT_DB);
  const today = stringArg(args.today, DEFAULT_TODAY);
  const rows = readWorkbookRows(file);
  const result = classifyWorkbookRows(rows, { today });
  insertImportResult(db, result, file);
  console.log(JSON.stringify({ db, source: file, today, rows: rows.length, summary: summarizeDb(db) }, null, 2));
}

async function decodeTemplate(args: Record<string, string | boolean>): Promise<void> {
  const db = stringArg(args.db, DEFAULT_DB);
  const rawInput = await resolveRawInput(args);
  const decoded = decodeCoinToolFCalldata(rawInput);
  const txHash = typeof args["tx-hash"] === "string" ? args["tx-hash"] : null;
  insertDecodedTemplate(db, { txHash, rawInput, decoded });
  console.log(JSON.stringify({ db, txHash, decoded }, null, 2));
}

function verify(args: Record<string, string | boolean>): void {
  const db = stringArg(args.db, DEFAULT_DB);
  console.log(JSON.stringify({ db, summary: summarizeDb(db), templates: listTemplates(db) }, null, 2));
}

function queue(args: Record<string, string | boolean>): void {
  const db = stringArg(args.db, DEFAULT_DB);
  const claimBatchSize = numberArg(args["claim-batch-size"], numberArg(args["max-batch-size"], 100));
  const plannedMintBatchSize = numberArg(args["planned-mint-batch-size"], 50);
  const result = queueRecords(db, { claimBatchSize, plannedMintBatchSize });
  console.log(JSON.stringify({ db, claimBatchSize, plannedMintBatchSize, ...result, summary: summarizeDb(db) }, null, 2));
}

function review(args: Record<string, string | boolean>): void {
  const db = stringArg(args.db, DEFAULT_DB);
  const limit = numberArg(args.limit, 50);
  console.log(JSON.stringify({ db, items: listReviewItems(db).slice(0, limit) }, null, 2));
}

async function daemon(args: Record<string, string | boolean>): Promise<void> {
  const db = stringArg(args.db, DEFAULT_DB);
  const maxFeeGwei = numberArg(args["max-fee-gwei"], Number.POSITIVE_INFINITY);
  const rpcUrl = stringArg(args["rpc-url"], process.env.RPC_URL ?? "");
  const dryRun = args.execute !== true;
  const gas = await getGasSnapshot(rpcUrl || undefined);
  const allowed = gasAllowsExecution(gas, maxFeeGwei);
  const queued = listQueuedItems(db, numberArg(args.limit, 20));
  const telegram =
    args.telegram === true
      ? await sendTelegramAlert({
          token: process.env.TELEGRAM_BOT_TOKEN,
          chatId: process.env.TELEGRAM_CHAT_ID,
          text: `XEN daemon dry-run: gas=${gas.gasPriceGwei ?? "unknown"} gwei, allowed=${allowed}, queuedPreview=${queued.length}`,
        })
      : "skipped";

  console.log(
    JSON.stringify(
      {
        db,
        dryRun,
        gas,
        maxFeeGwei: Number.isFinite(maxFeeGwei) ? maxFeeGwei : null,
        allowed,
        telegram,
        note:
          dryRun
            ? "Dry-run only. Use queued items plus decoded templates to inspect calldata before enabling a signer."
            : "Live execution requires installing viem and configuring the future signer adapter; this build refuses unsafe unsigned execution.",
        queued,
      },
      null,
      2,
    ),
  );
}

async function resolveRawInput(args: Record<string, string | boolean>): Promise<string> {
  if (typeof args["input-hex"] === "string") {
    return readFileSync(args["input-hex"], "utf8").trim();
  }
  if (typeof args["raw-input"] === "string") {
    return args["raw-input"];
  }
  if (typeof args["input-html"] === "string") {
    return extractRawInputFromEtherscanHtml(readFileSync(args["input-html"], "utf8"));
  }
  if (typeof args["tx-url"] === "string") {
    const response = await fetch(args["tx-url"]);
    if (!response.ok) {
      throw new Error(`Failed to fetch tx url: HTTP ${response.status}`);
    }
    return extractRawInputFromEtherscanHtml(await response.text());
  }
  if (typeof args["tx-hash"] === "string") {
    const rpcUrl = stringArg(args["rpc-url"], process.env.RPC_URL ?? "");
    if (!rpcUrl) {
      throw new Error("--tx-hash requires --rpc-url or RPC_URL");
    }
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionByHash", params: [args["tx-hash"]] }),
    });
    const payload = await response.json() as { result?: { input?: string } };
    if (!payload.result?.input) {
      throw new Error("RPC transaction result did not include input");
    }
    return payload.result.input;
  }
  throw new Error("decode-template requires --input-hex, --raw-input, --input-html, --tx-url, or --tx-hash");
}

function parseArgs(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
    const key = arg.slice(2);
    const next = args[i + 1];
    if (next == null || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function stringArg(value: unknown, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}

function numberArg(value: unknown, fallback: number): number {
  if (typeof value !== "string") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected number, got ${value}`);
  }
  return parsed;
}

function printHelp(): void {
  console.log(`Usage:
  node bin/xen-auto-mint.mjs import-excel --file <xlsx> [--db data/xen.sqlite] [--today YYYY-MM-DD]
  node bin/xen-auto-mint.mjs decode-template (--input-html <html>|--input-hex <file>|--raw-input <hex>|--tx-url <url>|--tx-hash <hash> --rpc-url <url>) [--db data/xen.sqlite]
  node bin/xen-auto-mint.mjs queue [--db data/xen.sqlite] [--claim-batch-size 100] [--planned-mint-batch-size 50]
  node bin/xen-auto-mint.mjs verify [--db data/xen.sqlite]
  node bin/xen-auto-mint.mjs review [--db data/xen.sqlite] [--limit 50]
  node bin/xen-auto-mint.mjs daemon [--db data/xen.sqlite] [--rpc-url <url>] [--max-fee-gwei N] [--limit 20]
`);
}

await main();
