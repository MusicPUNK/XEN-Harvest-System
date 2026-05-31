import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { metadataPathForCache, syncWorkbookCache } from "../src/cache.ts";

test("copies a workbook snapshot into the local cache and writes metadata", async () => {
  const dir = await mkdtemp(join(tmpdir(), "xen-cache-test-"));
  const sourceFile = join(dir, "source.xlsx");
  const cacheFile = join(dir, "cache", "google-sheet-cache.xlsx");
  await writeFile(sourceFile, Buffer.from("xlsx bytes"));

  const result = await syncWorkbookCache({
    sourceFile,
    cacheFile,
    sourceUrl: "https://drive.google.com/file/d/example",
    sourceTitle: "workbook.xlsx",
    syncedAt: "2026-05-04T10:00:00.000Z",
  });

  assert.equal((await readFile(cacheFile)).toString("utf8"), "xlsx bytes");
  assert.equal(result.cacheFile, cacheFile);
  assert.equal(result.metadataFile, metadataPathForCache(cacheFile));
  assert.equal(result.metadata.sourceTitle, "workbook.xlsx");
  assert.equal(result.metadata.sourceUrl, "https://drive.google.com/file/d/example");
  assert.equal(result.metadata.syncedAt, "2026-05-04T10:00:00.000Z");
  assert.equal(result.metadata.bytes, 10);

  const metadata = JSON.parse((await readFile(result.metadataFile)).toString("utf8"));
  assert.deepEqual(metadata, result.metadata);
});
