import { encodeAddress, encodeBytes, encodeUint, ensure0x, readWord, strip0x, wordToAddress, wordToNumber } from "./hex.ts";
import { keccak256Hex } from "./keccak.ts";
import { postJsonWithTimeout } from "./rpc.ts";

export const COINTOOL_BATCH_MINTER = "0x0de8bf93da2f7eecb3d9169422413a9bef4ef628";
export const DEFAULT_COINTOOL_SALT_HEX = "0x01";
export const XEN_CONTRACT = "0x06450dee7fd2fb8e39061434babcfc05599a6fb8";
const MULTICALL3_CONTRACT = "0xca11bde05977b3631167028862be2a173976ca11";

const COINTOOL_MAP_SELECTOR = "81aafabb";
const XEN_USER_MINTS_SELECTOR = "df282331";
const XEN_CURRENT_MAX_TERM_SELECTOR = "45125715";
const MULTICALL_AGGREGATE3_SELECTOR = "82ad56cb";
const MINIMAL_PROXY_PREFIX = "3d602d80600a3d3981f3363d3d373d3d3d363d73";
const MINIMAL_PROXY_SUFFIX = "5af43d82803e903d91602b57fd5bf3";
const SECONDS_PER_DAY = 24 * 60 * 60;
const COUNT_RPC_CONCURRENCY = 3;
const STATUS_MULTICALL_SIZE = 100;
const STATUS_MULTICALL_CONCURRENCY = 4;

export type EthereumRpcRequest = {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown[];
};

export type EthereumRpcResponse = {
  jsonrpc?: string;
  id?: number | string | null;
  result?: string;
  error?: {
    code?: number;
    message?: string;
  };
};

export type RpcTransport = (request: EthereumRpcRequest) => Promise<EthereumRpcResponse>;

export type ChainMintCount = {
  wallet: string;
  saltHex: string;
  count: number | null;
  status: "ok" | "error";
  checkedAt: string;
  error?: string;
};

export type ChainMintCandidate = {
  sheet: string;
  rowNumber: number;
  wallet: string;
  idStart: number;
  idEnd: number;
  label?: string;
  baseLabel?: string;
  remintRound?: number;
};

export type ChainMintStatus = ChainMintCandidate & {
  proxyAddress: string;
  checkedAt: string;
  status: "active" | "claimable" | "claimed_or_empty" | "error";
  term: number | null;
  maturityTs: number | null;
  unlockTime: string | null;
  rank: number | null;
  error?: string;
};

export type ChainReadOptions = {
  rpcUrl: string;
  saltHex?: string;
  contractAddress?: string;
  xenContractAddress?: string;
  transport?: RpcTransport;
  nowTs?: number;
  rpcTimeoutMs?: number;
};

export function buildCoinToolMapCallData(
  wallet: string,
  saltHex = DEFAULT_COINTOOL_SALT_HEX,
): `0x${string}` {
  return ensure0x(COINTOOL_MAP_SELECTOR + encodeAddress(wallet) + encodeUint(64) + encodeBytes(saltHex));
}

export function buildCoinToolProxyAddress(input: {
  wallet: string;
  id: number;
  saltHex?: string;
  contractAddress?: string;
}): string {
  const wallet = strip0x(input.wallet).toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(wallet)) {
    throw new Error(`Invalid wallet address: ${input.wallet}`);
  }
  const contractAddress = strip0x(input.contractAddress ?? COINTOOL_BATCH_MINTER).toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(contractAddress)) {
    throw new Error(`Invalid CoinTool contract address: ${input.contractAddress}`);
  }
  const saltHex = strip0x(input.saltHex ?? DEFAULT_COINTOOL_SALT_HEX).toLowerCase();
  const salt = strip0x(keccak256Hex(`0x${saltHex}${encodeUint(input.id)}${wallet}`));
  const initCodeHash = strip0x(coinToolProxyInitCodeHash(input.contractAddress ?? COINTOOL_BATCH_MINTER));
  const addressHash = strip0x(keccak256Hex(`0xff${contractAddress}${salt}${initCodeHash}`));
  return ensure0x(addressHash.slice(-40));
}

export function buildXenUserMintsCallData(user: string): `0x${string}` {
  return ensure0x(XEN_USER_MINTS_SELECTOR + encodeAddress(user));
}

export async function readXenCurrentMaxTermDays(input: ChainReadOptions): Promise<number> {
  const xenContractAddress = input.xenContractAddress ?? XEN_CONTRACT;
  const request: EthereumRpcRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [
      {
        to: xenContractAddress,
        data: ensure0x(XEN_CURRENT_MAX_TERM_SELECTOR),
      },
      "latest",
    ],
  };
  const response = await (input.transport ?? ((rpcRequest) => postRpc(input.rpcUrl, rpcRequest, input.rpcTimeoutMs)))(request);
  if (response.error) {
    throw new Error(response.error.message ?? `RPC error ${response.error.code ?? ""}`.trim());
  }
  if (!response.result) {
    throw new Error("RPC response did not include a result");
  }
  const seconds = wordToNumber(readWord(response.result, 0));
  return Math.max(1, Math.floor(seconds / SECONDS_PER_DAY));
}

export async function readCoinToolMintCount(input: ChainReadOptions & { wallet: string }): Promise<number> {
  const saltHex = input.saltHex ?? DEFAULT_COINTOOL_SALT_HEX;
  const contractAddress = input.contractAddress ?? COINTOOL_BATCH_MINTER;
  const request: EthereumRpcRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [
      {
        to: contractAddress,
        data: buildCoinToolMapCallData(input.wallet, saltHex),
      },
      "latest",
    ],
  };
  const response = await retryRpcRead(() => (
    input.transport ?? ((rpcRequest) => postRpc(input.rpcUrl, rpcRequest, input.rpcTimeoutMs))
  )(request), { retryTimeouts: false });
  if (response.error) {
    throw new Error(response.error.message ?? `RPC error ${response.error.code ?? ""}`.trim());
  }
  if (!response.result) {
    throw new Error("RPC response did not include a result");
  }
  return wordToNumber(readWord(response.result, 0));
}

export async function readCoinToolMintStatuses(
  candidates: ChainMintCandidate[],
  options: ChainReadOptions,
): Promise<ChainMintStatus[]> {
  const checkedAt = new Date().toISOString();
  const saltHex = options.saltHex ?? DEFAULT_COINTOOL_SALT_HEX;
  const contractAddress = options.contractAddress ?? COINTOOL_BATCH_MINTER;
  const xenContractAddress = options.xenContractAddress ?? XEN_CONTRACT;
  const nowTs = options.nowTs ?? await readLatestBlockTimestamp(options).catch(() => Math.floor(Date.now() / 1000));
  if (!options.transport) {
    return readCoinToolMintStatusesBatched(candidates, {
      ...options,
      checkedAt,
      saltHex,
      contractAddress,
      xenContractAddress,
      nowTs,
    });
  }
  const transport = options.transport;
  return mapWithConcurrency(candidates, 20, async (candidate, index) => {
    let proxyAddress = "";
    try {
      proxyAddress = buildCoinToolProxyAddress({
        wallet: candidate.wallet,
        id: candidate.idStart,
        saltHex,
        contractAddress,
      });
      const request: EthereumRpcRequest = {
        jsonrpc: "2.0",
        id: index + 1000,
        method: "eth_call",
        params: [
          {
            to: xenContractAddress,
            data: buildXenUserMintsCallData(proxyAddress),
          },
          "latest",
        ],
      };
      const response = await transport(request);
      return mintStatusFromResponse(candidate, proxyAddress, response, checkedAt, nowTs);
    } catch (error) {
      return mintStatusError(candidate, proxyAddress, checkedAt, error);
    }
  });
}

async function readCoinToolMintStatusesBatched(
  candidates: ChainMintCandidate[],
  options: ChainReadOptions & {
    checkedAt: string;
    saltHex: string;
    contractAddress: string;
    xenContractAddress: string;
    nowTs: number;
  },
): Promise<ChainMintStatus[]> {
  const results = new Array<ChainMintStatus>(candidates.length);
  const requestContexts: Array<{
    index: number;
    candidate: ChainMintCandidate;
    proxyAddress: string;
    request: EthereumRpcRequest;
  }> = [];
  for (const [index, candidate] of candidates.entries()) {
    try {
      const proxyAddress = buildCoinToolProxyAddress({
        wallet: candidate.wallet,
        id: candidate.idStart,
        saltHex: options.saltHex,
        contractAddress: options.contractAddress,
      });
      requestContexts.push({
        index,
        candidate,
        proxyAddress,
        request: {
          jsonrpc: "2.0",
          id: index + 1000,
          method: "eth_call",
          params: [
            {
              to: options.xenContractAddress,
              data: buildXenUserMintsCallData(proxyAddress),
            },
            "latest",
          ],
        },
      });
    } catch (error) {
      results[index] = mintStatusError(candidate, "", options.checkedAt, error);
    }
  }

  const chunks = chunkArray(requestContexts, STATUS_MULTICALL_SIZE);
  await mapWithConcurrency(chunks, STATUS_MULTICALL_CONCURRENCY, async (chunk) => {
    try {
      const responses = await postMulticallBatch(options.rpcUrl, chunk.map((context) => context.request), options.rpcTimeoutMs);
      for (const context of chunk) {
        const response = responses.get(String(context.request.id));
        if (!response) {
          results[context.index] = mintStatusError(context.candidate, context.proxyAddress, options.checkedAt, new Error("RPC batch response missing item"));
          continue;
        }
        results[context.index] = mintStatusFromResponse(context.candidate, context.proxyAddress, response, options.checkedAt, options.nowTs);
      }
    } catch (error) {
      for (const context of chunk) {
        results[context.index] = mintStatusError(context.candidate, context.proxyAddress, options.checkedAt, error);
      }
    }
  });

  return results;
}

function mintStatusFromResponse(
  candidate: ChainMintCandidate,
  proxyAddress: string,
  response: EthereumRpcResponse,
  checkedAt: string,
  nowTs: number,
): ChainMintStatus {
  if (response.error) {
    throw new Error(response.error.message ?? `RPC error ${response.error.code ?? ""}`.trim());
  }
  if (!response.result) {
    throw new Error("RPC response did not include a result");
  }
  const mint = decodeXenUserMint(response.result);
  const status = mint.rank <= 0 ? "claimed_or_empty" : nowTs >= mint.maturityTs ? "claimable" : "active";
  return {
    ...candidate,
    proxyAddress,
    checkedAt,
    status,
    term: mint.rank <= 0 ? null : mint.term,
    maturityTs: mint.rank <= 0 ? null : mint.maturityTs,
    unlockTime: mint.rank <= 0 ? null : new Date(mint.maturityTs * 1000).toISOString(),
    rank: mint.rank <= 0 ? null : mint.rank,
  };
}

function mintStatusError(
  candidate: ChainMintCandidate,
  proxyAddress: string,
  checkedAt: string,
  error: unknown,
): ChainMintStatus {
  return {
    ...candidate,
    proxyAddress,
    checkedAt,
    status: "error",
    term: null,
    maturityTs: null,
    unlockTime: null,
    rank: null,
    error: (error as Error).message,
  };
}

function chunkArray<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export async function readCoinToolMintCounts(
  wallets: string[],
  options: ChainReadOptions,
): Promise<ChainMintCount[]> {
  const checkedAt = new Date().toISOString();
  const saltHex = options.saltHex ?? DEFAULT_COINTOOL_SALT_HEX;
  const uniqueWallets = dedupeWallets(wallets);
  return mapWithConcurrency(
    uniqueWallets,
    COUNT_RPC_CONCURRENCY,
    async (wallet) => {
      try {
        const count = await readCoinToolMintCount({ ...options, wallet, saltHex });
        return { wallet, saltHex, count, status: "ok" as const, checkedAt };
      } catch (error) {
        return {
          wallet,
          saltHex,
          count: null,
          status: "error" as const,
          checkedAt,
          error: (error as Error).message,
        };
      }
    },
  );
}

function coinToolProxyInitCodeHash(contractAddress = COINTOOL_BATCH_MINTER): `0x${string}` {
  return keccak256Hex(`0x${MINIMAL_PROXY_PREFIX}${strip0x(contractAddress).toLowerCase()}${MINIMAL_PROXY_SUFFIX}`);
}

function decodeXenUserMint(result: string): { user: string; term: number; maturityTs: number; rank: number; amplifier: number; eaaRate: number } {
  return {
    user: wordToAddress(readWord(result, 0)),
    term: wordToNumber(readWord(result, 1)),
    maturityTs: wordToNumber(readWord(result, 2)),
    rank: wordToNumber(readWord(result, 3)),
    amplifier: wordToNumber(readWord(result, 4)),
    eaaRate: wordToNumber(readWord(result, 5)),
  };
}

async function readLatestBlockTimestamp(options: ChainReadOptions): Promise<number> {
  const response = await (options.transport ?? ((rpcRequest) => postRpc(options.rpcUrl, rpcRequest, options.rpcTimeoutMs)))({
    jsonrpc: "2.0",
    id: 999,
    method: "eth_getBlockByNumber",
    params: ["latest", false],
  });
  if (response.error) {
    throw new Error(response.error.message ?? `RPC error ${response.error.code ?? ""}`.trim());
  }
  const block = response.result as unknown as { timestamp?: string };
  if (!block?.timestamp) {
    throw new Error("RPC block response did not include a timestamp");
  }
  return Number.parseInt(block.timestamp, 16);
}

async function mapWithConcurrency<T, U>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function dedupeWallets(wallets: string[]): string[] {
  const byLower = new Map<string, string>();
  for (const wallet of wallets) {
    const key = wallet.toLowerCase();
    if (!byLower.has(key)) {
      byLower.set(key, wallet);
    }
  }
  return [...byLower.values()];
}

export function encodeXenUserMintResult(input: {
  user?: string;
  term?: number;
  maturityTs?: number;
  rank?: number;
  amplifier?: number;
  eaaRate?: number;
}): string {
  return ensure0x(
    encodeAddress(input.user ?? "0x0000000000000000000000000000000000000000") +
      encodeUint(input.term ?? 0) +
      encodeUint(input.maturityTs ?? 0) +
      encodeUint(input.rank ?? 0) +
      encodeUint(input.amplifier ?? 0) +
      encodeUint(input.eaaRate ?? 0),
  );
}

async function postRpc(rpcUrl: string, request: EthereumRpcRequest, timeoutMs?: number): Promise<EthereumRpcResponse> {
  return postJsonWithTimeout<EthereumRpcResponse>(rpcUrl, request, { timeoutMs });
}

async function postMulticallBatch(rpcUrl: string, requests: EthereumRpcRequest[], timeoutMs?: number): Promise<Map<string, EthereumRpcResponse>> {
  const calls = requests.map((request) => {
    const params = request.params[0] as { to: string; data: string };
    return { id: request.id, target: params.to, callData: params.data };
  });
  const response = await retryRpcRead(() => postRpc(rpcUrl, {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [
      {
        to: MULTICALL3_CONTRACT,
        data: buildMulticallAggregate3Calldata(calls),
      },
      "latest",
    ],
  }, timeoutMs), { retryTimeouts: true });
  if (response.error) {
    throw new Error(response.error.message ?? `RPC error ${response.error.code ?? ""}`.trim());
  }
  if (!response.result) {
    throw new Error("Multicall response did not include a result");
  }
  return decodeMulticallAggregate3Result(calls, response.result);
}

function buildMulticallAggregate3Calldata(calls: Array<{ target: string; callData: string }>): `0x${string}` {
  const heads: string[] = [];
  const tails: string[] = [];
  let tailOffset = 32 * calls.length;
  for (const call of calls) {
    const encodedBytes = encodeBytes(call.callData);
    const tuple = encodeAddress(call.target) + encodeUint(1) + encodeUint(96) + encodedBytes;
    heads.push(encodeUint(tailOffset));
    tails.push(tuple);
    tailOffset += tuple.length / 2;
  }
  return ensure0x(
    MULTICALL_AGGREGATE3_SELECTOR +
      encodeUint(32) +
      encodeUint(calls.length) +
      heads.join("") +
      tails.join(""),
  );
}

function decodeMulticallAggregate3Result(
  calls: Array<{ id: number | string | null; target: string; callData: string }>,
  result: string,
): Map<string, EthereumRpcResponse> {
  const clean = strip0x(result);
  const arrayOffset = wordToNumber(readWord(result, 0));
  const arrayStart = arrayOffset * 2;
  const length = wordToNumber(clean.slice(arrayStart, arrayStart + 64));
  const tupleHeadStart = arrayStart + 64;
  const responses = new Map<string, EthereumRpcResponse>();
  for (let index = 0; index < length; index += 1) {
    const call = calls[index];
    if (!call) {
      continue;
    }
    const tupleOffset = wordToNumber(clean.slice(tupleHeadStart + index * 64, tupleHeadStart + (index + 1) * 64));
    const tupleStart = tupleHeadStart + tupleOffset * 2;
    const success = wordToNumber(clean.slice(tupleStart, tupleStart + 64)) !== 0;
    const bytesOffset = wordToNumber(clean.slice(tupleStart + 64, tupleStart + 128));
    const bytesStart = tupleStart + bytesOffset * 2;
    const byteLength = wordToNumber(clean.slice(bytesStart, bytesStart + 64));
    const returnData = ensure0x(clean.slice(bytesStart + 64, bytesStart + 64 + byteLength * 2));
    responses.set(String(call.id), success
      ? { jsonrpc: "2.0", id: call.id, result: returnData }
      : { jsonrpc: "2.0", id: call.id, error: { message: "Multicall item failed" } });
  }
  return responses;
}

async function retryRpcRead(
  read: () => Promise<EthereumRpcResponse>,
  options: { retryTimeouts: boolean },
): Promise<EthereumRpcResponse> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      lastError = error;
      const message = (error as Error).message;
      const retryable = /HTTP 429/i.test(message) || (options.retryTimeouts && /timed out/i.test(message));
      if (!retryable || attempt === 4) {
        throw error;
      }
      await sleep(500 * 2 ** attempt);
    }
  }
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
