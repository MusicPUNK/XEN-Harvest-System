import type { ChainMintCandidate, ChainMintCount, ChainMintStatus } from "./chain.ts";
import type { GasSnapshot } from "./gas.ts";
import type { WorkbookRow } from "./models.ts";
import type { CoinToolHistoryTransaction } from "./tx-history.ts";
import { buildClaimRemintCalldata, buildMintCalldata } from "./template.ts";

const DEMO_WALLET = "0x1111111111111111111111111111111111111111";
const DEMO_SHEET = "X7-8f39";

const demoLabels = [
  "1-100",
  "101-125",
  "126-225",
  "F 226-250",
  "251-350",
  "F 351-375",
  "376-475",
  "FF 476-500",
  "501-600",
  "F 601-625",
  "626-725",
  "FF 726-750",
  "751-850",
  "F 851-875",
  "876-975",
];

export function demoWorkbookRows(): WorkbookRow[] {
  return demoLabels.map((label, index) => ({
    sheet: DEMO_SHEET,
    rowNumber: index + 2,
    wallet: DEMO_WALLET,
    label,
    mintDateRaw: 250101,
    termDaysRaw: 469,
    expiryRaw: 260514,
    quantityRaw: rangeQuantity(label),
    claimAmountRaw: null,
  }));
}

export async function demoChainCounts(wallets: string[]): Promise<ChainMintCount[]> {
  return wallets.map((wallet) => ({
    wallet,
    saltHex: "0x01",
    count: 50_000,
    status: "ok" as const,
    checkedAt: new Date().toISOString(),
  }));
}

export async function demoChainMintStatuses(candidates: ChainMintCandidate[]): Promise<ChainMintStatus[]> {
  const checkedAt = new Date().toISOString();
  return candidates.map((candidate, index) => {
    const quantity = candidate.idEnd - candidate.idStart + 1;
    const rank = 36_743_690 + candidate.idStart - 1 + index * 12;
    return {
      ...candidate,
      proxyAddress: `0x${String(candidate.idStart).padStart(40, "0").slice(-40)}`,
      checkedAt,
      status: "claimable" as const,
      term: 469,
      maturityTs: 1_768_111_200 + index * 60,
      unlockTime: new Date((1_768_111_200 + index * 60) * 1000).toISOString(),
      rank,
      rankEnd: rank + quantity - 1,
    } as ChainMintStatus;
  });
}

export async function demoGasSnapshot(): Promise<GasSnapshot> {
  return {
    source: "rpc",
    gasPriceGwei: 0.1,
    checkedAt: new Date().toISOString(),
  };
}

export async function demoCoinToolTransactions(): Promise<CoinToolHistoryTransaction[]> {
  return [
    tx(1, buildMintCalldata({ total: 975, termDays: 469, saltHex: "0x01" })),
    tx(2, buildClaimRemintCalldata({
      ids: [...rangeIds(226, 250), ...rangeIds(351, 375), ...rangeIds(601, 625), ...rangeIds(851, 875)],
      wallet: DEMO_WALLET,
      termDays: 469,
      target: "0xc7ba94123464105a42f0f6c4093f0b16a5ce5c98",
      innerSelector: "0x68154343",
      saltHex: "0x01",
    })),
    tx(3, buildClaimRemintCalldata({
      ids: [...rangeIds(476, 500), ...rangeIds(726, 750)],
      wallet: DEMO_WALLET,
      termDays: 469,
      target: "0xc7ba94123464105a42f0f6c4093f0b16a5ce5c98",
      innerSelector: "0x68154343",
      saltHex: "0x01",
    })),
  ];
}

function rangeQuantity(label: string): number {
  const match = label.match(/(\d+)\s*-\s*(\d+)/);
  if (!match) {
    return 0;
  }
  return Number(match[2]) - Number(match[1]) + 1;
}

function tx(blockNumber: number, input: string): CoinToolHistoryTransaction {
  return {
    hash: `0x${String(blockNumber).padStart(64, "0")}`,
    from: DEMO_WALLET,
    input,
    blockNumber,
    transactionIndex: 0,
  };
}

function rangeIds(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
