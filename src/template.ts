import { encodeAddress, encodeBytes, encodeUint, ensure0x, readWord, strip0x, wordToAddress, wordToNumber } from "./hex.ts";

export type DecodedCoinToolF = {
  selector: string;
  ids: number[];
  inner: {
    selector: string;
    target: string;
    innerSelector: string | null;
    remintWallet: string | null;
    remintTermDays: number | null;
  };
  saltHex: string;
};

export type DecodedCoinToolT = {
  selector: string;
  total: number;
  inner: {
    selector: string;
    target: string;
    claimRankTermDays: number | null;
  };
  saltHex: string;
};

export type ClaimRemintTemplateInput = {
  ids: number[];
  wallet: string;
  termDays: number;
  target: string;
  innerSelector: string;
  saltHex: string;
};

export type ClaimTemplateInput = {
  ids: number[];
  saltHex: string;
};

export type MintTemplateInput = {
  total: number;
  termDays: number;
  saltHex: string;
  target?: string;
};

const OUTER_F_SELECTOR = "c2580804";
const INNER_D_SELECTOR = "c40493dc";
const OUTER_T_SELECTOR = "b1ae2ed1";
const INNER_C_SELECTOR = "59635f6f";
const CLAIM_RANK_SELECTOR = "9ff054df";
const XEN_CONTRACT = "0x06450dee7fd2fb8e39061434babcfc05599a6fb8";

export function extractRawInputFromEtherscanHtml(html: string): string {
  const match = html.match(/<span id=['"]rawinput['"][^>]*>(0x[0-9a-fA-F]+)<\/span>/);
  if (!match) {
    throw new Error("Could not find rawinput in Etherscan HTML");
  }
  return ensure0x(match[1]);
}

export function decodeCoinToolFCalldata(input: string): DecodedCoinToolF {
  const clean = strip0x(input).toLowerCase();
  if (clean.slice(0, 8) !== OUTER_F_SELECTOR) {
    throw new Error(`Expected CoinTool f selector 0x${OUTER_F_SELECTOR}, got 0x${clean.slice(0, 8)}`);
  }

  const data = clean.slice(8);
  const arrayOffset = wordToNumber(readWord(data, 0));
  const innerOffset = wordToNumber(readWord(data, 1));
  const saltOffset = wordToNumber(readWord(data, 2));

  const ids = decodeUintArray(data, arrayOffset);
  const innerBytes = decodeBytes(data, innerOffset);
  const saltHex = ensure0x(decodeBytes(data, saltOffset));
  const inner = decodeInnerD(innerBytes);

  return {
    selector: `0x${OUTER_F_SELECTOR}`,
    ids,
    inner,
    saltHex,
  };
}

export function decodeCoinToolTCalldata(input: string): DecodedCoinToolT {
  const clean = strip0x(input).toLowerCase();
  if (clean.slice(0, 8) !== OUTER_T_SELECTOR) {
    throw new Error(`Expected CoinTool t selector 0x${OUTER_T_SELECTOR}, got 0x${clean.slice(0, 8)}`);
  }

  const data = clean.slice(8);
  const total = wordToNumber(readWord(data, 0));
  const innerOffset = wordToNumber(readWord(data, 1));
  const saltOffset = wordToNumber(readWord(data, 2));
  const innerBytes = decodeBytes(data, innerOffset);
  const saltHex = ensure0x(decodeBytes(data, saltOffset));

  return {
    selector: `0x${OUTER_T_SELECTOR}`,
    total,
    inner: decodeInnerC(innerBytes),
    saltHex,
  };
}

export function buildClaimRemintCalldata(input: ClaimRemintTemplateInput): string {
  const remintCall = buildRemintCall(input.wallet, input.termDays, input.innerSelector);
  const dCall = INNER_D_SELECTOR + encodeAddress(input.target) + encodeUint(64) + encodeBytes(remintCall);
  return buildCoinToolFCalldata(input.ids, `0x${dCall}`, input.saltHex);
}

export function buildClaimCalldata(input: ClaimTemplateInput): string {
  return buildCoinToolFCalldata(input.ids, "0x", input.saltHex);
}

function buildCoinToolFCalldata(ids: number[], innerData: string, saltHex: string): string {
  const idsEncoded = encodeUintArray(ids);
  const dataEncoded = encodeBytes(innerData);
  const saltEncoded = encodeBytes(saltHex);
  const headSize = 3 * 32;
  const idsOffset = headSize;
  const dataOffset = idsOffset + idsEncoded.length / 2;
  const saltOffset = dataOffset + dataEncoded.length / 2;

  return ensure0x(
    OUTER_F_SELECTOR +
      encodeUint(idsOffset) +
      encodeUint(dataOffset) +
      encodeUint(saltOffset) +
      idsEncoded +
      dataEncoded +
      saltEncoded,
  );
}

export function buildMintCalldata(input: MintTemplateInput): string {
  const claimRankCall = CLAIM_RANK_SELECTOR + encodeUint(input.termDays);
  const cCall = INNER_C_SELECTOR + encodeAddress(input.target ?? XEN_CONTRACT) + encodeUint(64) + encodeBytes(`0x${claimRankCall}`);
  const dataEncoded = encodeBytes(`0x${cCall}`);
  const saltEncoded = encodeBytes(input.saltHex);

  const headSize = 3 * 32;
  const dataOffset = headSize;
  const saltOffset = dataOffset + dataEncoded.length / 2;

  return ensure0x(
    OUTER_T_SELECTOR +
      encodeUint(input.total) +
      encodeUint(dataOffset) +
      encodeUint(saltOffset) +
      dataEncoded +
      saltEncoded,
  );
}

function decodeUintArray(data: string, byteOffset: number): number[] {
  const wordIndex = byteOffset / 32;
  const length = wordToNumber(readWord(data, wordIndex));
  const values: number[] = [];
  for (let i = 0; i < length; i += 1) {
    values.push(wordToNumber(readWord(data, wordIndex + 1 + i)));
  }
  return values;
}

function decodeBytes(data: string, byteOffset: number): string {
  const wordIndex = byteOffset / 32;
  const byteLength = wordToNumber(readWord(data, wordIndex));
  const start = (wordIndex + 1) * 64;
  return data.slice(start, start + byteLength * 2);
}

function decodeInnerD(innerBytes: string): DecodedCoinToolF["inner"] {
  const clean = strip0x(innerBytes).toLowerCase();
  const selector = `0x${clean.slice(0, 8)}`;
  if (clean.slice(0, 8) !== INNER_D_SELECTOR) {
    return {
      selector,
      target: "0x0000000000000000000000000000000000000000",
      innerSelector: null,
      remintWallet: null,
      remintTermDays: null,
    };
  }

  const args = clean.slice(8);
  const target = wordToAddress(readWord(args, 0));
  const nestedOffset = wordToNumber(readWord(args, 1));
  const nested = decodeBytes(args, nestedOffset);
  const nestedSelector = `0x${nested.slice(0, 8)}`;
  const nestedArgs = nested.slice(8);
  const remintWallet = nestedArgs.length >= 64 ? wordToAddress(readWord(nestedArgs, 0)) : null;
  const remintTermDays = nestedArgs.length >= 128 ? wordToNumber(readWord(nestedArgs, 1)) : null;

  return {
    selector,
    target,
    innerSelector: nestedSelector,
    remintWallet,
    remintTermDays,
  };
}

function decodeInnerC(innerBytes: string): DecodedCoinToolT["inner"] {
  const clean = strip0x(innerBytes).toLowerCase();
  const selector = `0x${clean.slice(0, 8)}`;
  if (clean.slice(0, 8) !== INNER_C_SELECTOR) {
    return {
      selector,
      target: "0x0000000000000000000000000000000000000000",
      claimRankTermDays: null,
    };
  }

  const args = clean.slice(8);
  const target = wordToAddress(readWord(args, 0));
  const nestedOffset = wordToNumber(readWord(args, 1));
  const nested = decodeBytes(args, nestedOffset);
  const nestedSelector = nested.slice(0, 8);
  const nestedArgs = nested.slice(8);
  return {
    selector,
    target,
    claimRankTermDays: nestedSelector === CLAIM_RANK_SELECTOR && nestedArgs.length >= 64
      ? wordToNumber(readWord(nestedArgs, 0))
      : null,
  };
}

function buildRemintCall(wallet: string, termDays: number, selector: string): string {
  return strip0x(selector).toLowerCase() + encodeAddress(wallet) + encodeUint(termDays);
}

function encodeUintArray(values: number[]): string {
  return encodeUint(values.length) + values.map((value) => encodeUint(value)).join("");
}
