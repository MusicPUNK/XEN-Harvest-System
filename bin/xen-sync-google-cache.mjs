#!/usr/bin/env node
import { fileURLToPath } from "node:url";

import { assertSupportedNodeVersion } from "../scripts/check-node-version.mjs";

assertSupportedNodeVersion();

const { syncWorkbookCache } = await import("../src/cache.ts");

const DEFAULT_CACHE_FILE = fileURLToPath(new URL("../data/google-sheet-cache.xlsx", import.meta.url));
const args = parseArgs(process.argv.slice(2));

try {
  const result = await syncWorkbookCache({
    cacheFile: args["cache-file"] ?? process.env.XEN_GOOGLE_CACHE_FILE ?? DEFAULT_CACHE_FILE,
    sourceFile: args["source-file"],
    sourceUrl: args["download-url"] ?? args["source-url"],
    sourceTitle: args["source-title"] ?? "workbook.xlsx",
    sourceLink: args["source-link"],
  });

  console.log(
    JSON.stringify(
      {
        cacheFile: result.cacheFile,
        metadataFile: result.metadataFile,
        sourceTitle: result.metadata.sourceTitle,
        sourceUrl: result.metadata.sourceUrl,
        syncedAt: result.metadata.syncedAt,
        bytes: result.metadata.bytes,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
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
