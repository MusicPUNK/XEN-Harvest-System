#!/usr/bin/env node
import { fileURLToPath } from "node:url";

import { assertSupportedNodeVersion } from "../scripts/check-node-version.mjs";

assertSupportedNodeVersion();

const { DEFAULT_CHAIN_STATUS_TIMEOUT_MS, listenDashboardServer } = await import("../src/dashboard-server.ts");

const DEFAULT_CACHE_FILE = fileURLToPath(new URL("../data/google-sheet-cache.xlsx", import.meta.url));
const DEFAULT_RPC_URL = "https://ethereum.publicnode.com";
const args = parseArgs(process.argv.slice(2));
const excelFile = args.file ?? process.env.XEN_EXCEL_FILE;
const cacheFile = args["cache-file"] ?? process.env.XEN_GOOGLE_CACHE_FILE ?? DEFAULT_CACHE_FILE;
const googleSheetUrl = args["google-sheet-url"] ?? process.env.GOOGLE_SHEET_URL;
const googleDownloadUrl = args["google-download-url"] ?? process.env.GOOGLE_DOWNLOAD_URL ?? process.env.XEN_GOOGLE_DOWNLOAD_URL;
const host = args.host ?? process.env.HOST ?? "127.0.0.1";
const startPort = Number(args.port ?? process.env.PORT ?? 4173);
const dueSoonDays = Number(args["due-soon-days"] ?? process.env.DUE_SOON_DAYS ?? 14);
const maxFeeGwei = Number(args["max-fee-gwei"] ?? process.env.MAX_FEE_GWEI ?? 0);
const claimBatchSize = Number(args["claim-batch-size"] ?? process.env.CLAIM_BATCH_SIZE ?? 100);
const plannedMintBatchSize = Number(args["planned-mint-batch-size"] ?? process.env.PLANNED_MINT_BATCH_SIZE ?? 50);
const rpcTimeoutMs = Number(args["rpc-timeout-ms"] ?? process.env.RPC_TIMEOUT_MS ?? 10000);
const chainStatusTimeoutMs = Number(args["chain-status-timeout-ms"] ?? process.env.CHAIN_STATUS_TIMEOUT_MS ?? DEFAULT_CHAIN_STATUS_TIMEOUT_MS);
const etherscanApiKey = args["etherscan-api-key"] ?? process.env.ETHERSCAN_API_KEY;
const etherscanChainId = Number(args["etherscan-chain-id"] ?? process.env.ETHERSCAN_CHAIN_ID ?? 1);
const publicMode = args.public !== "false" && process.env.XEN_PUBLIC_MODE !== "0";
const demoClaimable = args["demo-claimable"] === "true" || process.env.XEN_DEMO_CLAIMABLE === "1";
const demoHooks = demoClaimable ? await import("../src/demo-data.ts") : null;
const serverOptions = {
  excelFile,
  cacheFile: publicMode ? undefined : cacheFile,
  googleSheetUrl: publicMode || demoClaimable ? undefined : googleSheetUrl,
  googleDownloadUrl: publicMode || demoClaimable ? undefined : googleDownloadUrl,
  host,
  dueSoonDays,
  claimBatchSize,
  plannedMintBatchSize,
  maxFeeGwei,
  rpcTimeoutMs,
  chainStatusTimeoutMs,
  etherscanApiKey: demoClaimable ? undefined : etherscanApiKey,
  etherscanChainId,
  publicMode,
  rpcUrl: args["rpc-url"] ?? process.env.RPC_URL ?? DEFAULT_RPC_URL,
  today: demoClaimable ? "2026-05-14" : undefined,
  readRows: demoHooks ? demoHooks.demoWorkbookRows : undefined,
  getChainCounts: demoHooks ? demoHooks.demoChainCounts : undefined,
  getChainMintStatuses: demoHooks ? demoHooks.demoChainMintStatuses : undefined,
  getCoinToolTransactions: demoHooks ? demoHooks.demoCoinToolTransactions : undefined,
  getGas: demoHooks ? demoHooks.demoGasSnapshot : undefined,
};
const allowPortFallback = args["allow-port-fallback"] === "true" || process.env.ALLOW_PORT_FALLBACK === "1";
const { server, url } = allowPortFallback ? await listenWithFallback({
  ...serverOptions,
  startPort,
}) : await listenDashboardServer({
  ...serverOptions,
  port: startPort,
});

console.log("XEN 一键收菜系统 read-only dashboard");
console.log(`URL: ${url}`);
if (publicMode) {
  console.log("Source: public chain monitor (no workbook/cache reads)");
} else {
  console.log(`Cache: ${cacheFile}`);
  console.log(`Google Sheet: ${googleSheetUrl ?? "not configured"}`);
  console.log(`Fallback Excel: ${excelFile ?? "not configured"}`);
}
console.log(`RPC: ${args["rpc-url"] ?? process.env.RPC_URL ?? DEFAULT_RPC_URL}`);
console.log(`History: ${demoClaimable ? "demo" : etherscanApiKey ? "Etherscan" : "disabled (set ETHERSCAN_API_KEY to enable)"}`);
console.log(`Batch: mint ${plannedMintBatchSize}, claim ${claimBatchSize}`);
if (demoClaimable) {
  console.log("Demo: simulated mature claim+remint batches enabled");
}
console.log("Mode: browser wallet confirmation; backend holds no private keys");

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});

async function listenWithFallback({ startPort, ...options }) {
  let lastError = null;
  for (let port = startPort; port < startPort + 10; port += 1) {
    try {
      return await listenDashboardServer({ ...options, port });
    } catch (error) {
      lastError = error;
      if (error.code !== "EADDRINUSE") {
        throw error;
      }
    }
  }
  throw lastError;
}

function parseArgs(values) {
  const parsed = {};
  for (let i = 0; i < values.length; i += 1) {
    const arg = values[i];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    const key = arg.slice(2);
    const next = values[i + 1];
    if (next == null || next.startsWith("--")) {
      parsed[key] = "true";
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}
