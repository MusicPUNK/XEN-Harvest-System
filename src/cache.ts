import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}>;

export type WorkbookCacheMetadata = {
  sourceTitle: string | null;
  sourceUrl: string | null;
  syncedAt: string;
  bytes: number;
};

export type SyncWorkbookCacheOptions = {
  cacheFile: string;
  sourceFile?: string;
  sourceUrl?: string;
  sourceLink?: string;
  sourceTitle?: string;
  syncedAt?: string;
  fetchImpl?: FetchLike;
};

export type SyncWorkbookCacheResult = {
  cacheFile: string;
  metadataFile: string;
  metadata: WorkbookCacheMetadata;
};

export function metadataPathForCache(cacheFile: string): string {
  return `${cacheFile}.meta.json`;
}

export async function readWorkbookCacheMetadata(cacheFile: string): Promise<WorkbookCacheMetadata | null> {
  try {
    return JSON.parse(await readFile(metadataPathForCache(cacheFile), "utf8")) as WorkbookCacheMetadata;
  } catch {
    return null;
  }
}

export async function syncWorkbookCache(options: SyncWorkbookCacheOptions): Promise<SyncWorkbookCacheResult> {
  if (!options.sourceFile && !options.sourceUrl) {
    throw new Error("syncWorkbookCache requires sourceFile or sourceUrl");
  }

  const bytes = options.sourceFile ? await readFile(options.sourceFile) : await downloadBytes(options.sourceUrl!, options.fetchImpl);
  await mkdir(dirname(options.cacheFile), { recursive: true });
  await writeFile(options.cacheFile, bytes);

  const metadata: WorkbookCacheMetadata = {
    sourceTitle: options.sourceTitle ?? null,
    sourceUrl: options.sourceLink ?? options.sourceUrl ?? null,
    syncedAt: options.syncedAt ?? new Date().toISOString(),
    bytes: bytes.byteLength,
  };
  const metadataFile = metadataPathForCache(options.cacheFile);
  await writeFile(metadataFile, `${JSON.stringify(metadata, null, 2)}\n`);
  return { cacheFile: options.cacheFile, metadataFile, metadata };
}

async function downloadBytes(sourceUrl: string, fetchImpl: FetchLike = fetch): Promise<Buffer> {
  const response = await fetchImpl(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download workbook snapshot: HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
