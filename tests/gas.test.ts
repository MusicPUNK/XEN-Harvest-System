import test from "node:test";
import assert from "node:assert/strict";

import { getGasSnapshot } from "../src/gas.ts";

type RpcRequestBody = {
  id: number;
  method: string;
  params: unknown[];
};

function parseRpcRequest(init?: RequestInit): RpcRequestBody {
  return JSON.parse(String(init?.body)) as RpcRequestBody;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("uses fee history base fee for gas snapshots", async () => {
  const originalFetch = globalThis.fetch;
  const latestBaseFeeWei = 79_000_000n;
  const previousBaseFeeWei = 69_000_000n;
  const methods: string[] = [];

  globalThis.fetch = async (_url, init) => {
    const request = parseRpcRequest(init);
    methods.push(request.method);
    assert.equal(request.method, "eth_feeHistory");
    assert.deepEqual(request.params, ["0x1", "latest", []]);
    return jsonResponse({
      jsonrpc: "2.0",
      id: request.id,
      result: {
        baseFeePerGas: [
          `0x${previousBaseFeeWei.toString(16)}`,
          `0x${latestBaseFeeWei.toString(16)}`,
        ],
      },
    });
  };

  try {
    const snapshot = await getGasSnapshot("https://rpc.example");
    assert.equal(snapshot.gasPriceGwei, 0.079);
    assert.deepEqual(methods, ["eth_feeHistory"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("falls back to gas price when fee history is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  const legacyGasPriceWei = 69_000_000n;
  const methods: string[] = [];

  globalThis.fetch = async (_url, init) => {
    const request = parseRpcRequest(init);
    methods.push(request.method);
    if (request.method === "eth_feeHistory") {
      return jsonResponse({
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32601, message: "method not found" },
      });
    }
    assert.equal(request.method, "eth_gasPrice");
    return jsonResponse({
      jsonrpc: "2.0",
      id: request.id,
      result: `0x${legacyGasPriceWei.toString(16)}`,
    });
  };

  try {
    const snapshot = await getGasSnapshot("https://rpc.example");
    assert.equal(snapshot.gasPriceGwei, 0.069);
    assert.deepEqual(methods, ["eth_feeHistory", "eth_gasPrice"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("times out gas RPC requests", async () => {
  const originalFetch = globalThis.fetch;
  let sawAbort = false;
  globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => {
    const signal = init?.signal;
    signal?.addEventListener("abort", () => {
      sawAbort = true;
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    });
  }) as Promise<Response>;

  try {
    await assert.rejects(
      getGasSnapshot("https://rpc.example", { timeoutMs: 1 }),
      /RPC gas request timed out after 1ms/,
    );
    assert.equal(sawAbort, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
