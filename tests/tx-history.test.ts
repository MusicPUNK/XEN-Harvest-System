import test from "node:test";
import assert from "node:assert/strict";

import { buildCoinToolHistoryIndex } from "../src/tx-history.ts";
import { buildClaimRemintCalldata, buildMintCalldata } from "../src/template.ts";

const wallet = "0x1111111111111111111111111111111111111111";

test("counts remint rounds per wallet-local id from CoinTool T/F history", () => {
  const history = buildCoinToolHistoryIndex([
    tx({ blockNumber: 1, transactionIndex: 0, input: buildMintCalldata({ total: 100, termDays: 469, saltHex: "0x01" }) }),
    tx({ blockNumber: 2, transactionIndex: 0, input: buildClaimRemintCalldata({
      ids: rangeIds(1, 25),
      wallet,
      termDays: 469,
      target: "0xc7ba94123464105a42f0f6c4093f0b16a5ce5c98",
      innerSelector: "0x68154343",
      saltHex: "0x01",
    }) }),
    tx({ blockNumber: 3, transactionIndex: 0, input: buildClaimRemintCalldata({
      ids: rangeIds(1, 10),
      wallet,
      termDays: 469,
      target: "0xc7ba94123464105a42f0f6c4093f0b16a5ce5c98",
      innerSelector: "0x68154343",
      saltHex: "0x01",
    }) }),
  ]);

  assert.equal(history.wallets[wallet.toLowerCase()].mintedCount, 100);
  assert.equal(history.remintRound(wallet, 1), 2);
  assert.equal(history.remintRound(wallet, 10), 2);
  assert.equal(history.remintRound(wallet, 11), 1);
  assert.equal(history.remintRound(wallet, 25), 1);
  assert.equal(history.remintRound(wallet, 26), 0);
  assert.equal(history.rangeRemintRound(wallet, 1, 10), 2);
  assert.equal(history.rangeRemintRound(wallet, 1, 25), null);
  assert.equal(history.rangeRemintRound(wallet, 26, 100), 0);
  assert.deepEqual(history.currentRanges(wallet), [
    { wallet, idStart: 1, idEnd: 10, method: "F", remintRound: 2 },
    { wallet, idStart: 11, idEnd: 25, method: "F", remintRound: 1 },
    { wallet, idStart: 26, idEnd: 100, method: "T", remintRound: 0 },
  ]);
});

function tx(overrides: Partial<Parameters<typeof buildCoinToolHistoryIndex>[0][number]>) {
  return {
    hash: `0x${String(overrides.blockNumber ?? 0).padStart(64, "0")}`,
    from: wallet,
    input: "0x",
    blockNumber: 1,
    transactionIndex: 0,
    ...overrides,
  };
}

function rangeIds(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
