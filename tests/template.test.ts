import test from "node:test";
import assert from "node:assert/strict";

import {
  buildClaimCalldata,
  buildMintCalldata,
  buildClaimRemintCalldata,
  decodeCoinToolFCalldata,
  decodeCoinToolTCalldata,
  extractRawInputFromEtherscanHtml,
} from "../src/template.ts";

const raw45 =
  "0xc2580804" +
  "0000000000000000000000000000000000000000000000000000000000000060" +
  "0000000000000000000000000000000000000000000000000000000000000620" +
  "0000000000000000000000000000000000000000000000000000000000000720" +
  "000000000000000000000000000000000000000000000000000000000000002d" +
  Array.from({ length: 45 }, (_, i) => (0x544d + i).toString(16).padStart(64, "0")).join("") +
  "00000000000000000000000000000000000000000000000000000000000000c4" +
  "c40493dc" +
  "000000000000000000000000c7ba94123464105a42f0f6c4093f0b16a5ce5c98" +
  "0000000000000000000000000000000000000000000000000000000000000040" +
  "0000000000000000000000000000000000000000000000000000000000000044" +
  "68154343" +
  "0000000000000000000000002222222222222222222222222222222222222222" +
  "00000000000000000000000000000000000000000000000000000000000001d5" +
  "00000000000000000000000000000000000000000000000000000000" +
  "00000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000001" +
  "01" +
  "00000000000000000000000000000000000000000000000000000000000000";

test("decodes CoinTool f(uint256[],bytes,bytes) claim+remint calldata", () => {
  const decoded = decodeCoinToolFCalldata(raw45);

  assert.equal(decoded.selector, "0xc2580804");
  assert.equal(decoded.ids.length, 45);
  assert.equal(decoded.ids[0], 21581);
  assert.equal(decoded.ids.at(-1), 21625);
  assert.equal(decoded.inner.selector, "0xc40493dc");
  assert.equal(decoded.inner.target.toLowerCase(), "0xc7ba94123464105a42f0f6c4093f0b16a5ce5c98");
  assert.equal(decoded.inner.remintWallet?.toLowerCase(), "0x2222222222222222222222222222222222222222");
  assert.equal(decoded.inner.remintTermDays, 469);
  assert.equal(decoded.saltHex, "0x01");
});

test("builds claim+remint calldata equivalent to decoded template fields", () => {
  const decoded = decodeCoinToolFCalldata(raw45);
  const rebuilt = buildClaimRemintCalldata({
    ids: decoded.ids,
    wallet: decoded.inner.remintWallet!,
    termDays: decoded.inner.remintTermDays!,
    target: decoded.inner.target,
    innerSelector: decoded.inner.innerSelector!,
    saltHex: decoded.saltHex,
  });

  assert.equal(rebuilt.toLowerCase(), raw45.toLowerCase());
});

test("builds claim-only CoinTool f calldata with empty inner data", () => {
  const raw = buildClaimCalldata({
    ids: [22001, 22002, 22003],
    saltHex: "0x01",
  });
  const decoded = decodeCoinToolFCalldata(raw);

  assert.match(raw, /^0xc2580804/);
  assert.deepEqual(decoded.ids, [22001, 22002, 22003]);
  assert.equal(decoded.inner.remintWallet, null);
  assert.equal(decoded.inner.remintTermDays, null);
  assert.equal(decoded.saltHex, "0x01");
});

test("extracts raw input from an Etherscan html page", () => {
  const html = "<span id='rawinput' style='display:none''>0x1234abcd</span>";

  assert.equal(extractRawInputFromEtherscanHtml(html), "0x1234abcd");
});

test("builds CoinTool t(uint256,bytes,bytes) planned mint calldata from historical X7 template", () => {
  const historicalX7Mint =
    "0xb1ae2ed1" +
    "0000000000000000000000000000000000000000000000000000000000000050" +
    "0000000000000000000000000000000000000000000000000000000000000060" +
    "0000000000000000000000000000000000000000000000000000000000000140" +
    "00000000000000000000000000000000000000000000000000000000000000a4" +
    "59635f6f" +
    "00000000000000000000000006450dee7fd2fb8e39061434babcfc05599a6fb8" +
    "0000000000000000000000000000000000000000000000000000000000000040" +
    "0000000000000000000000000000000000000000000000000000000000000024" +
    "9ff054df" +
    "00000000000000000000000000000000000000000000000000000000000001c7" +
    "00000000000000000000000000000000000000000000000000000000" +
    "00000000000000000000000000000000000000000000000000000000" +
    "0000000000000000000000000000000000000000000000000000000000000001" +
    "01" +
    "00000000000000000000000000000000000000000000000000000000000000";

  assert.equal(
    buildMintCalldata({
      total: 80,
      termDays: 455,
      saltHex: "0x01",
    }),
    historicalX7Mint,
  );
});

test("decodes CoinTool t(uint256,bytes,bytes) mint calldata total and term", () => {
  const raw = buildMintCalldata({
    total: 100,
    termDays: 469,
    saltHex: "0x01",
  });
  const decoded = decodeCoinToolTCalldata(raw);

  assert.equal(decoded.selector, "0xb1ae2ed1");
  assert.equal(decoded.total, 100);
  assert.equal(decoded.inner.claimRankTermDays, 469);
  assert.equal(decoded.saltHex, "0x01");
});
