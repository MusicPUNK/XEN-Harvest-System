import test from "node:test";
import assert from "node:assert/strict";

import { keccak256Hex } from "../src/keccak.ts";

test("computes Ethereum keccak256 hashes", () => {
  assert.equal(
    keccak256Hex("0x"),
    "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
  );
  assert.equal(
    keccak256Hex("0x68656c6c6f"),
    "0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8",
  );
  assert.equal(keccak256Hex(Buffer.from("userMints(address)")).slice(0, 10), "0xdf282331");
});
