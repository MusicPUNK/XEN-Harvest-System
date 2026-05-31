import { postJsonWithTimeout } from "./rpc.ts";

export type GasSnapshot = {
  source: "rpc" | "unavailable";
  gasPriceGwei: number | null;
};

type FeeHistoryResponse = {
  result?: {
    baseFeePerGas?: string[];
  };
  error?: { message?: string };
};

type GasPriceResponse = {
  result?: string;
  error?: { message?: string };
};

export async function getGasSnapshot(rpcUrl?: string, options: { timeoutMs?: number } = {}): Promise<GasSnapshot> {
  if (!rpcUrl) {
    return { source: "unavailable", gasPriceGwei: null };
  }

  const baseFeeGwei = await readLatestBaseFeeGwei(rpcUrl, options);
  if (baseFeeGwei != null) {
    return { source: "rpc", gasPriceGwei: baseFeeGwei };
  }

  const payload = await postJsonWithTimeout<GasPriceResponse>(
    rpcUrl,
    { jsonrpc: "2.0", id: 1, method: "eth_gasPrice", params: [] },
    { timeoutMs: options.timeoutMs, errorPrefix: "RPC gas request" },
  );
  if (!payload.result) {
    throw new Error(payload.error?.message ?? "RPC gas request returned no result");
  }
  return { source: "rpc", gasPriceGwei: Number(BigInt(payload.result)) / 1e9 };
}

async function readLatestBaseFeeGwei(
  rpcUrl: string,
  options: { timeoutMs?: number },
): Promise<number | null> {
  const payload = await postJsonWithTimeout<FeeHistoryResponse>(
    rpcUrl,
    { jsonrpc: "2.0", id: 1, method: "eth_feeHistory", params: ["0x1", "latest", []] },
    { timeoutMs: options.timeoutMs, errorPrefix: "RPC gas request" },
  );
  const latestBaseFee = payload.result?.baseFeePerGas?.at(-1);
  if (payload.error || !latestBaseFee) {
    return null;
  }
  return Number(BigInt(latestBaseFee)) / 1e9;
}

export function gasAllowsExecution(snapshot: GasSnapshot, maxFeeGwei: number): boolean {
  return snapshot.gasPriceGwei != null && snapshot.gasPriceGwei <= maxFeeGwei;
}
