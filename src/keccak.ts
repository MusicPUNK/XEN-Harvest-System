import { strip0x } from "./hex.ts";

const MASK_64 = (1n << 64n) - 1n;
const RATE_BYTES = 136;
const ROUND_CONSTANTS = [
  0x0000000000000001n,
  0x0000000000008082n,
  0x800000000000808an,
  0x8000000080008000n,
  0x000000000000808bn,
  0x0000000080000001n,
  0x8000000080008081n,
  0x8000000000008009n,
  0x000000000000008an,
  0x0000000000000088n,
  0x0000000080008009n,
  0x000000008000000an,
  0x000000008000808bn,
  0x800000000000008bn,
  0x8000000000008089n,
  0x8000000000008003n,
  0x8000000000008002n,
  0x8000000000000080n,
  0x000000000000800an,
  0x800000008000000an,
  0x8000000080008081n,
  0x8000000000008080n,
  0x0000000080000001n,
  0x8000000080008008n,
];

const ROTATION_OFFSETS = [
  0, 1, 62, 28, 27,
  36, 44, 6, 55, 20,
  3, 10, 43, 25, 39,
  41, 45, 15, 21, 8,
  18, 2, 61, 56, 14,
];

export function keccak256Hex(input: string | Uint8Array): `0x${string}` {
  const bytes = typeof input === "string" ? hexToBytes(input) : input;
  const state = new Array<bigint>(25).fill(0n);
  const padded = keccakPad(bytes);

  for (let offset = 0; offset < padded.length; offset += RATE_BYTES) {
    const block = padded.subarray(offset, offset + RATE_BYTES);
    for (let i = 0; i < RATE_BYTES / 8; i += 1) {
      state[i] ^= bytesToLane(block, i * 8);
    }
    keccakF1600(state);
  }

  const output = new Uint8Array(32);
  for (let i = 0; i < output.length / 8; i += 1) {
    laneToBytes(state[i], output, i * 8);
  }
  return `0x${bytesToHex(output)}`;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = strip0x(hex).toLowerCase();
  if (clean.length % 2 !== 0 || !/^[0-9a-f]*$/.test(clean)) {
    throw new Error(`Invalid hex bytes: ${hex}`);
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function keccakPad(input: Uint8Array): Uint8Array {
  const paddedLength = Math.ceil((input.length + 1) / RATE_BYTES) * RATE_BYTES;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] = 0x01;
  padded[padded.length - 1] ^= 0x80;
  return padded;
}

function bytesToLane(bytes: Uint8Array, offset: number): bigint {
  let lane = 0n;
  for (let i = 0; i < 8; i += 1) {
    lane |= BigInt(bytes[offset + i] ?? 0) << BigInt(8 * i);
  }
  return lane;
}

function laneToBytes(lane: bigint, output: Uint8Array, offset: number): void {
  for (let i = 0; i < 8; i += 1) {
    output[offset + i] = Number((lane >> BigInt(8 * i)) & 0xffn);
  }
}

function keccakF1600(state: bigint[]): void {
  for (const roundConstant of ROUND_CONSTANTS) {
    const c = new Array<bigint>(5);
    const d = new Array<bigint>(5);
    for (let x = 0; x < 5; x += 1) {
      c[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
    }
    for (let x = 0; x < 5; x += 1) {
      d[x] = c[(x + 4) % 5] ^ rotateLeft64(c[(x + 1) % 5], 1);
    }
    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        state[x + 5 * y] = (state[x + 5 * y] ^ d[x]) & MASK_64;
      }
    }

    const b = new Array<bigint>(25).fill(0n);
    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        b[y + 5 * ((2 * x + 3 * y) % 5)] = rotateLeft64(state[x + 5 * y], ROTATION_OFFSETS[x + 5 * y]);
      }
    }

    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        state[x + 5 * y] = (b[x + 5 * y] ^ ((~b[((x + 1) % 5) + 5 * y]) & b[((x + 2) % 5) + 5 * y])) & MASK_64;
      }
    }
    state[0] = (state[0] ^ roundConstant) & MASK_64;
  }
}

function rotateLeft64(value: bigint, shift: number): bigint {
  const normalized = BigInt(shift % 64);
  if (normalized === 0n) {
    return value & MASK_64;
  }
  return ((value << normalized) | (value >> (64n - normalized))) & MASK_64;
}
