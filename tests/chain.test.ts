import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCoinToolMapCallData,
  buildCoinToolProxyAddress,
  buildXenUserMintsCallData,
  encodeXenUserMintResult,
  readCoinToolMintCount,
  readCoinToolMintCounts,
  readCoinToolMintStatuses,
  readXenCurrentMaxTermDays,
} from "../src/chain.ts";
import { encodeBytes, encodeUint } from "../src/hex.ts";

const wallet = "0x3333333333333333333333333333333333333333";

test("builds CoinTool map(address,bytes) calldata for wallet and salt", () => {
  const data = buildCoinToolMapCallData(wallet, "0x01");

  assert.equal(
    data,
    "0x81aafabb" +
      "0000000000000000000000003333333333333333333333333333333333333333" +
      "0000000000000000000000000000000000000000000000000000000000000040" +
      "0000000000000000000000000000000000000000000000000000000000000001" +
      "0100000000000000000000000000000000000000000000000000000000000000",
  );
});

test("reads a CoinTool minted count through an injected RPC transport", async () => {
  const seenRequests: unknown[] = [];
  const count = await readCoinToolMintCount({
    wallet,
    rpcUrl: "https://rpc.example",
    transport: async (request) => {
      seenRequests.push(request);
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: "0x000000000000000000000000000000000000000000000000000000000000c738",
      };
    },
  });

  assert.equal(count, 51000);
  assert.deepEqual(seenRequests, [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [
        {
          to: "0x0de8bf93da2f7eecb3d9169422413a9bef4ef628",
          data: buildCoinToolMapCallData(wallet, "0x01"),
        },
        "latest",
      ],
    },
  ]);
});

test("reads XEN current max mint term days from the official contract", async () => {
  const seenRequests: unknown[] = [];
  const days = await readXenCurrentMaxTermDays({
    rpcUrl: "https://rpc.example",
    transport: async (request) => {
      seenRequests.push(request);
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: "0x000000000000000000000000000000000000000000000000000000000299c580",
      };
    },
  });

  assert.equal(days, 505);
  assert.deepEqual(seenRequests, [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [
        {
          to: "0x06450dee7fd2fb8e39061434babcfc05599a6fb8",
          data: "0x45125715",
        },
        "latest",
      ],
    },
  ]);
});

test("derives CoinTool proxy addresses and builds XEN userMints calldata", () => {
  const proxyAddress = buildCoinToolProxyAddress({ wallet, id: 22001, saltHex: "0x01" });

  assert.match(proxyAddress, /^0x[0-9a-f]{40}$/);
  assert.equal(
    buildXenUserMintsCallData(proxyAddress),
    `0xdf282331000000000000000000000000${proxyAddress.slice(2)}`,
  );
});

test("reads XEN maturity status for a CoinTool proxy through an injected RPC transport", async () => {
  const seenRequests: unknown[] = [];
  const rows = await readCoinToolMintStatuses(
    [{ sheet: "X3-e599", rowNumber: 48, wallet, idStart: 22001, idEnd: 22100 }],
    {
      rpcUrl: "https://rpc.example",
      nowTs: 1_778_314_000,
      transport: async (request) => {
        seenRequests.push(request);
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: encodeXenUserMintResult({
            user: buildCoinToolProxyAddress({ wallet, id: 22001, saltHex: "0x01" }),
            term: 413,
            maturityTs: 1_778_314_631,
            rank: 30_914_510,
            amplifier: 1,
            eaaRate: 1,
          }),
        };
      },
    },
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "active");
  assert.equal(rows[0].term, 413);
  assert.equal(rows[0].maturityTs, 1_778_314_631);
  assert.equal(rows[0].unlockTime, "2026-05-09T08:17:11.000Z");
  assert.equal(rows[0].rank, 30_914_510);
  assert.equal((seenRequests[0] as { method: string }).method, "eth_call");
});

test("batches direct XEN maturity status RPC calls", async () => {
  const originalFetch = globalThis.fetch;
  const seenBodies: unknown[] = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    seenBodies.push(body);
    const mintResult = encodeXenUserMintResult({
      user: "0x0000000000000000000000000000000000000001",
      term: 469,
      maturityTs: 1_778_314_631,
      rank: 30_914_510,
      amplifier: 1,
      eaaRate: 1,
    });
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: body.id,
      result: encodeMulticallAggregate3Result([mintResult, mintResult]),
    }), { status: 200 });
  };

  try {
    const rows = await readCoinToolMintStatuses(
      [
        { sheet: "X1", rowNumber: 1, wallet, idStart: 1, idEnd: 100 },
        { sheet: "X1", rowNumber: 101, wallet, idStart: 101, idEnd: 200 },
      ],
      { rpcUrl: "https://rpc.example", nowTs: 1_700_000_000 },
    );

    assert.equal(rows.length, 2);
    assert.equal(rows[0].status, "active");
    assert.equal(seenBodies.length, 1);
    assert.equal(Array.isArray(seenBodies[0]), false);
    assert.equal((seenBodies[0] as { method: string }).method, "eth_call");
    const params = (seenBodies[0] as { params: Array<{ to: string; data: string } | string> }).params;
    assert.equal((params[0] as { to: string }).to, "0xca11bde05977b3631167028862be2a173976ca11");
    assert.match((params[0] as { data: string }).data, /^0x82ad56cb/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("splits large direct XEN maturity status batches into smaller multicalls", async () => {
  const originalFetch = globalThis.fetch;
  const multicallSizes: number[] = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    const clean = String(body.params[0].data).slice(2);
    const size = Number.parseInt(clean.slice(72, 136), 16);
    multicallSizes.push(size);
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: body.id,
      result: encodeMulticallAggregate3Result(Array.from({ length: size }, () => encodeXenUserMintResult({
        user: "0x0000000000000000000000000000000000000001",
        term: 469,
        maturityTs: 1_778_314_631,
        rank: 30_914_510,
        amplifier: 1,
        eaaRate: 1,
      }))),
    }), { status: 200 });
  };

  try {
    const candidates = Array.from({ length: 101 }, (_, index) => ({
      sheet: "X1",
      rowNumber: index + 1,
      wallet,
      idStart: index + 1,
      idEnd: index + 1,
    }));
    const rows = await readCoinToolMintStatuses(candidates, { rpcUrl: "https://rpc.example", nowTs: 1_700_000_000 });

    assert.equal(rows.length, 101);
    assert.deepEqual(multicallSizes, [100, 1]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("retries batched XEN maturity status RPC calls after rate limiting", async () => {
  const originalFetch = globalThis.fetch;
  let multicallCalls = 0;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    multicallCalls += 1;
    if (multicallCalls === 1) {
      return new Response("rate limited", { status: 429 });
    }
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: body.id,
      result: encodeMulticallAggregate3Result([
        encodeXenUserMintResult({
          user: "0x0000000000000000000000000000000000000001",
          term: 469,
          maturityTs: 1_778_314_631,
          rank: 30_914_510,
          amplifier: 1,
          eaaRate: 1,
        }),
      ]),
    }), { status: 200 });
  };

  try {
    const rows = await readCoinToolMintStatuses(
      [{ sheet: "X1", rowNumber: 1, wallet, idStart: 1, idEnd: 100 }],
      { rpcUrl: "https://rpc.example", nowTs: 1_700_000_000 },
    );

    assert.equal(multicallCalls, 2);
    assert.equal(rows[0].status, "active");
    assert.equal(rows[0].unlockTime, "2026-05-09T08:17:11.000Z");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("returns per-wallet chain count errors without failing the whole batch", async () => {
  let calls = 0;
  const rows = await readCoinToolMintCounts([wallet, "0x0000000000000000000000000000000000000001"], {
    rpcUrl: "https://rpc.example",
    transport: async (request) => {
      calls += 1;
      if (calls === 2) {
        throw new Error("rate limited");
      }
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: "0x000000000000000000000000000000000000000000000000000000000000c738",
      };
    },
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].wallet.toLowerCase(), wallet.toLowerCase());
  assert.equal(rows[0].count, 51000);
  assert.equal(rows[0].status, "ok");
  assert.equal(rows[1].count, null);
  assert.equal(rows[1].status, "error");
  assert.match(rows[1].error ?? "", /rate limited/);
});

test("retries transient chain count rate limits before marking a wallet failed", async () => {
  const throttledWallet = "0x0000000000000000000000000000000000000001";
  const callsByWallet = new Map<string, number>();
  const rows = await readCoinToolMintCounts([wallet, throttledWallet], {
    rpcUrl: "https://rpc.example",
    transport: async (request) => {
      const data = (request.params[0] as { data: string }).data;
      const requestedWallet = `0x${data.slice(34, 74)}`;
      callsByWallet.set(requestedWallet, (callsByWallet.get(requestedWallet) ?? 0) + 1);
      if (requestedWallet === throttledWallet.toLowerCase() && callsByWallet.get(requestedWallet) === 1) {
        throw new Error("RPC request failed: HTTP 429");
      }
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: requestedWallet === throttledWallet.toLowerCase()
          ? "0x0000000000000000000000000000000000000000000000000000000000000064"
          : "0x000000000000000000000000000000000000000000000000000000000000c738",
      };
    },
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].count, 51000);
  assert.equal(rows[0].status, "ok");
  assert.equal(rows[1].wallet, throttledWallet);
  assert.equal(rows[1].count, 100);
  assert.equal(rows[1].status, "ok");
  assert.equal(callsByWallet.get(throttledWallet), 2);
});

test("times out direct RPC mint count requests", async () => {
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
      readCoinToolMintCount({ wallet, rpcUrl: "https://rpc.example", rpcTimeoutMs: 1 }),
      /RPC request timed out after 1ms/,
    );
    assert.equal(sawAbort, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function encodeMulticallAggregate3Result(returnDatas: string[]): string {
  const heads: string[] = [];
  const tails: string[] = [];
  let tailOffset = 32 * returnDatas.length;
  for (const returnData of returnDatas) {
    const tuple = encodeUint(1) + encodeUint(64) + encodeBytes(returnData);
    heads.push(encodeUint(tailOffset));
    tails.push(tuple);
    tailOffset += tuple.length / 2;
  }
  return `0x${encodeUint(32)}${encodeUint(returnDatas.length)}${heads.join("")}${tails.join("")}`;
}
