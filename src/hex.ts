export function strip0x(hex: string): string {
  return hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
}

export function ensure0x(hex: string): `0x${string}` {
  return (hex.startsWith("0x") ? hex.toLowerCase() : `0x${hex.toLowerCase()}`) as `0x${string}`;
}

export function padWord(hex: string): string {
  const clean = strip0x(hex);
  if (clean.length > 64) {
    throw new Error(`Hex word too long: ${hex}`);
  }
  return clean.padStart(64, "0");
}

export function encodeUint(value: number | bigint): string {
  const asBigInt = typeof value === "bigint" ? value : BigInt(value);
  if (asBigInt < 0n) {
    throw new Error("Cannot encode negative uint");
  }
  return asBigInt.toString(16).padStart(64, "0");
}

export function encodeAddress(address: string): string {
  const clean = strip0x(address).toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(clean)) {
    throw new Error(`Invalid address: ${address}`);
  }
  return clean.padStart(64, "0");
}

export function encodeBytes(hex: string): string {
  const clean = strip0x(hex).toLowerCase();
  if (clean.length % 2 !== 0 || !/^[0-9a-f]*$/.test(clean)) {
    throw new Error(`Invalid bytes: ${hex}`);
  }
  const byteLength = clean.length / 2;
  const paddedLength = Math.ceil(clean.length / 64) * 64;
  return encodeUint(byteLength) + clean.padEnd(paddedLength, "0");
}

export function readWord(data: string, wordIndex: number): string {
  const clean = strip0x(data);
  const start = wordIndex * 64;
  const word = clean.slice(start, start + 64);
  if (word.length !== 64) {
    throw new Error(`Missing ABI word at index ${wordIndex}`);
  }
  return word;
}

export function wordToNumber(word: string): number {
  const value = BigInt(`0x${word}`);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`ABI uint exceeds safe integer: ${word}`);
  }
  return Number(value);
}

export function wordToAddress(word: string): string {
  return ensure0x(word.slice(24));
}
