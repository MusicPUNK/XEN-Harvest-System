import test from "node:test";
import assert from "node:assert/strict";

import { assertSupportedNodeVersion, compareVersions, parseNodeVersion } from "../scripts/check-node-version.mjs";

test("parses node version strings", () => {
  assert.deepEqual(parseNodeVersion("v22.22.0"), { major: 22, minor: 22, patch: 0 });
  assert.deepEqual(parseNodeVersion("24.14.0"), { major: 24, minor: 14, patch: 0 });
});

test("compares semantic node versions", () => {
  assert.equal(compareVersions("22.22.0", "22.22.0"), 0);
  assert.equal(compareVersions("22.22.1", "22.22.0"), 1);
  assert.equal(compareVersions("24.0.0", "22.22.0"), 1);
  assert.equal(compareVersions("22.21.9", "22.22.0"), -1);
});

test("accepts Node 22.22.0 and rejects older runtimes with a helpful message", () => {
  assert.doesNotThrow(() => assertSupportedNodeVersion("v22.22.0"));
  assert.throws(
    () => assertSupportedNodeVersion("v22.21.9"),
    /Node\.js >=22\.22\.0 is required/,
  );
});
