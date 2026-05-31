import test from "node:test";
import assert from "node:assert/strict";

import { readEtherscanCoinToolTransactions } from "../src/etherscan.ts";
import { COINTOOL_BATCH_MINTER } from "../src/chain.ts";

test("reads and filters CoinTool T/F transactions from Etherscan txlist responses", async () => {
  const rows = await readEtherscanCoinToolTransactions(["0xabc0000000000000000000000000000000000000"], {
    apiKey: "test",
    fetchJson: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: "1",
        result: [
          tx({ hash: "0x1", input: "0xb1ae2ed1abcd" }),
          tx({ hash: "0x2", input: "0xc2580804abcd" }),
          tx({ hash: "0x3", to: "0x0000000000000000000000000000000000000001", input: "0xc2580804abcd" }),
          tx({ hash: "0x4", input: "0x12345678" }),
        ],
      }),
    } as Response),
  });

  assert.deepEqual(rows.map((row) => row.hash), ["0x1", "0x2"]);
  assert.equal(rows[0].blockNumber, 100);
  assert.equal(rows[0].transactionIndex, 2);
});

test("times out Etherscan history requests", async () => {
  await assert.rejects(
    readEtherscanCoinToolTransactions(["0xabc0000000000000000000000000000000000000"], {
      apiKey: "test",
      timeoutMs: 1,
      fetchJson: async () => new Promise(() => {}),
    }),
    /Etherscan history request timed out after 1ms/,
  );
});

function tx(overrides: Partial<Record<string, string>>) {
  return {
    hash: "0x1",
    from: "0xabc0000000000000000000000000000000000000",
    to: COINTOOL_BATCH_MINTER,
    input: "0x",
    blockNumber: "100",
    transactionIndex: "2",
    ...overrides,
  };
}
