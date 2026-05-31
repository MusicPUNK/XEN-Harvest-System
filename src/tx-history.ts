import { decodeCoinToolFCalldata, decodeCoinToolTCalldata } from "./template.ts";

export type CoinToolHistoryTransaction = {
  hash: string;
  from: string;
  input: string;
  blockNumber: number;
  transactionIndex: number;
};

export type WalletHistoryState = {
  wallet: string;
  mintedCount: number;
  remintRounds: Map<number, number>;
  currentEvents: Map<number, string>;
  events: Map<string, { method: "T" | "F" }>;
};

export type CoinToolCurrentRange = {
  wallet: string;
  idStart: number;
  idEnd: number;
  method: "T" | "F";
  remintRound: number;
};

export type CoinToolHistoryIndex = {
  wallets: Record<string, { wallet: string; mintedCount: number }>;
  remintRound(wallet: string, id: number): number | null;
  rangeRemintRound(wallet: string, idStart: number, idEnd: number): number | null;
  currentRanges(wallet: string): CoinToolCurrentRange[];
};

export function buildCoinToolHistoryIndex(transactions: CoinToolHistoryTransaction[]): CoinToolHistoryIndex {
  const states = new Map<string, WalletHistoryState>();
  const sorted = [...transactions].sort((a, b) => (
    a.blockNumber - b.blockNumber ||
    a.transactionIndex - b.transactionIndex ||
    a.hash.localeCompare(b.hash)
  ));

  for (const tx of sorted) {
    const selector = tx.input.slice(0, 10).toLowerCase();
    if (selector === "0xb1ae2ed1") {
      const decoded = decodeCoinToolTCalldata(tx.input);
      const state = walletState(states, tx.from);
      const start = state.mintedCount + 1;
      const end = state.mintedCount + decoded.total;
      const eventKey = `${tx.hash}:T:${tx.blockNumber}:${tx.transactionIndex}`;
      state.events.set(eventKey, { method: "T" });
      for (let id = start; id <= end; id += 1) {
        state.currentEvents.set(id, eventKey);
      }
      state.mintedCount += decoded.total;
    } else if (selector === "0xc2580804") {
      const decoded = decodeCoinToolFCalldata(tx.input);
      const wallet = decoded.inner.remintWallet ?? tx.from;
      const state = walletState(states, wallet);
      const eventKey = `${tx.hash}:F:${tx.blockNumber}:${tx.transactionIndex}`;
      state.events.set(eventKey, { method: "F" });
      for (const id of decoded.ids) {
        state.remintRounds.set(id, (state.remintRounds.get(id) ?? 0) + 1);
        state.currentEvents.set(id, eventKey);
      }
    }
  }

  return {
    wallets: Object.fromEntries([...states].map(([key, state]) => [
      key,
      { wallet: state.wallet, mintedCount: state.mintedCount },
    ])),
    remintRound(wallet, id) {
      const state = states.get(wallet.toLowerCase());
      if (!state) {
        return null;
      }
      return state.remintRounds.get(id) ?? 0;
    },
    rangeRemintRound(wallet, idStart, idEnd) {
      const state = states.get(wallet.toLowerCase());
      if (!state) {
        return null;
      }
      let round: number | null = null;
      for (let id = idStart; id <= idEnd; id += 1) {
        const idRound = state.remintRounds.get(id) ?? 0;
        if (round == null) {
          round = idRound;
        } else if (round !== idRound) {
          return null;
        }
      }
      return round;
    },
    currentRanges(wallet) {
      const state = states.get(wallet.toLowerCase());
      return state ? currentRangesForState(state) : [];
    },
  };
}

function currentRangesForState(state: WalletHistoryState): CoinToolCurrentRange[] {
  const ranges: CoinToolCurrentRange[] = [];
  let rangeStart: number | null = null;
  let rangeEnd: number | null = null;
  let rangeKey: string | null = null;
  let rangeRound: number | null = null;
  for (let id = 1; id <= state.mintedCount; id += 1) {
    const eventKey = state.currentEvents.get(id);
    const round = state.remintRounds.get(id) ?? 0;
    if (eventKey == null) {
      continue;
    }
    if (rangeStart == null || rangeEnd == null || rangeKey !== eventKey || rangeRound !== round) {
      pushCurrentRange(ranges, state, rangeStart, rangeEnd, rangeKey, rangeRound);
      rangeStart = id;
      rangeEnd = id;
      rangeKey = eventKey;
      rangeRound = round;
      continue;
    }
    rangeEnd = id;
  }
  pushCurrentRange(ranges, state, rangeStart, rangeEnd, rangeKey, rangeRound);
  return ranges;
}

function pushCurrentRange(
  ranges: CoinToolCurrentRange[],
  state: WalletHistoryState,
  start: number | null,
  end: number | null,
  eventKey: string | null,
  round: number | null,
): void {
  if (start == null || end == null || eventKey == null || round == null) {
    return;
  }
  const event = state.events.get(eventKey);
  if (!event) {
    return;
  }
  ranges.push({
    wallet: state.wallet,
    idStart: start,
    idEnd: end,
    method: event.method,
    remintRound: round,
  });
}

function walletState(map: Map<string, WalletHistoryState>, wallet: string): WalletHistoryState {
  const key = wallet.toLowerCase();
  const existing = map.get(key);
  if (existing) {
    return existing;
  }
  const state = {
    wallet,
    mintedCount: 0,
    remintRounds: new Map<number, number>(),
    currentEvents: new Map<number, string>(),
    events: new Map<string, { method: "T" | "F" }>(),
  };
  map.set(key, state);
  return state;
}
