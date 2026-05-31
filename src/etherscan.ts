import { COINTOOL_BATCH_MINTER } from "./chain.ts";
import type { CoinToolHistoryTransaction } from "./tx-history.ts";

export type EtherscanOptions = {
  apiKey: string;
  chainId?: number;
  contractAddress?: string;
  fetchJson?: typeof fetch;
  timeoutMs?: number;
};

const DEFAULT_ETHERSCAN_TIMEOUT_MS = 10_000;

export async function readEtherscanCoinToolTransactions(
  wallets: string[],
  options: EtherscanOptions,
): Promise<CoinToolHistoryTransaction[]> {
  const fetchJson = options.fetchJson ?? fetch;
  const contract = (options.contractAddress ?? COINTOOL_BATCH_MINTER).toLowerCase();
  const transactions: CoinToolHistoryTransaction[] = [];
  for (const wallet of wallets) {
    const url = new URL("https://api.etherscan.io/v2/api");
    url.searchParams.set("chainid", String(options.chainId ?? 1));
    url.searchParams.set("module", "account");
    url.searchParams.set("action", "txlist");
    url.searchParams.set("address", wallet);
    url.searchParams.set("startblock", "0");
    url.searchParams.set("endblock", "99999999");
    url.searchParams.set("page", "1");
    url.searchParams.set("offset", "10000");
    url.searchParams.set("sort", "asc");
    url.searchParams.set("apikey", options.apiKey);
    const response = await fetchEtherscanWithTimeout(fetchJson, url, options.timeoutMs ?? DEFAULT_ETHERSCAN_TIMEOUT_MS);
    if (!response.ok) {
      throw new Error(`Etherscan history request failed: HTTP ${response.status}`);
    }
    const payload = await response.json() as {
      status?: string;
      message?: string;
      result?: unknown;
    };
    if (!Array.isArray(payload.result)) {
      throw new Error(`Etherscan history request failed: ${payload.message ?? "invalid response"}`);
    }
    for (const row of payload.result as Array<Record<string, string>>) {
      const input = row.input ?? "";
      if ((row.to ?? "").toLowerCase() !== contract || !isCoinToolMethod(input)) {
        continue;
      }
      transactions.push({
        hash: row.hash,
        from: row.from,
        input,
        blockNumber: Number.parseInt(row.blockNumber, 10),
        transactionIndex: Number.parseInt(row.transactionIndex ?? "0", 10),
      });
    }
  }
  return transactions;
}

async function fetchEtherscanWithTimeout(
  fetchJson: typeof fetch,
  url: URL,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      fetchJson(url, { signal: controller.signal }),
      new Promise<Response>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error(`Etherscan history request timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function isCoinToolMethod(input: string): boolean {
  const selector = input.slice(0, 10).toLowerCase();
  return selector === "0xb1ae2ed1" || selector === "0xc2580804";
}
