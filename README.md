# XEN 一键收菜系统

XEN 一键收菜系统 is a local browser-wallet dashboard for XEN/CoinTool wallet operations. It lets users monitor their own wallet addresses, scan CoinTool mint counts on-chain, preview claim / claim+remint / mint actions, and confirm every transaction through their browser wallet.

The current build is deliberately conservative. Planned `mint`, plain `claim`, and `claim+remint` can generate CoinTool transaction previews and ask the browser wallet to sign sequential transactions. The backend never stores private keys or broadcasts autonomous transactions.

## Tech Stack

- Node.js ESM, requiring Node.js `>=22.22.0`.
- TypeScript syntax run directly by modern Node type stripping in `src/**/*.ts` and `tests/**/*.ts`.
- Native `node:test` test runner.
- Browser dashboard served by Node's built-in HTTP server.
- Ethereum JSON-RPC calls for gas and CoinTool `map(address,bytes)` chain count checks.

## Main Features

- Adds wallet addresses locally in the browser for public monitoring mode.
- Scans CoinTool minted counts on-chain for each monitored wallet.
- Derives claimable and active proxy-id ranges from chain state.
- Generates planned mint previews with batches of `50` ids and claim/remint previews with batches of `100` ids.
- Builds CoinTool planned mint calldata for `t(uint256,bytes,bytes)`.
- Dashboard supports multi-transaction planned mint previews and sequential browser-wallet confirmations.
- Dashboard supports CoinTool-style manual claim and claim+remint batch selection, including grouped batch previews.
- When `ETHERSCAN_API_KEY` is configured, the dashboard can pull CoinTool `T`/`F` transaction history, derive chain-side remint rounds per wallet-local id, and flag table-vs-chain round mismatches.

## Install Dependencies

```bash
npm install
```

The public dashboard only needs Node.js dependencies.

## Run Locally

Start the dashboard in public wallet-monitor mode:

```bash
npm run dashboard
```

The server listens on `127.0.0.1` by default. Wallet addresses are stored in your own browser storage; the backend does not save private keys, seed phrases, or wallet passwords.

Do not expose this server directly to the public internet without adding your own authentication and rate limiting.

Common environment variables:

```bash
RPC_URL="https://ethereum.publicnode.com"
MAX_FEE_GWEI="1"
COINTOOL_SALT_HEX="0x01"
ETHERSCAN_API_KEY="<optional-history-check-key>"
```

The default RPC is a public endpoint for trial use. For larger scans, set your own `RPC_URL`.

## Run Tests

```bash
npm run test
```

Equivalent direct command:

```bash
node scripts/check-node-version.mjs && node --test tests/*.test.ts tests/*.test.mjs
```

Dashboard JavaScript syntax check:

```bash
npm run check:dashboard-js
```

Equivalent direct command:

```bash
node --check public/dashboard.js
```

There is currently no `lint` or `build` script in `package.json`.

## Project Structure

- `bin/` - CLI entrypoints for the local dashboard.
- `src/queue.ts` - queue chunking rules for planned mint and claim/remint.
- `src/action-preview.ts` - planned mint, selected claim, and selected claim+remint preview generation.
- `src/template.ts` - CoinTool calldata decoding/building helpers.
- `src/chain.ts` - CoinTool chain count RPC calls.
- `src/dashboard-data.ts` - dashboard summary and per-wallet rows.
- `src/dashboard-server.ts` - HTTP API and static dashboard server.
- `public/` - dashboard HTML/CSS/JS.
- `tests/` - Node test coverage for wallet monitoring, queue, chain, dashboard, and calldata behavior.
- `scripts/` - Node version check and optional local service helpers.
- `data/`, `outputs/`, and `memory/` - local/generated/private runtime files; intentionally ignored by Git.

## Security Model

- The backend does not store private keys or seed phrases.
- The backend does not sign transactions.
- The browser wallet is the only signer.
- Local runtime data, caches, databases, and logs should not be committed.
- Public RPC endpoints are useful for testing, but users with many wallets should configure their own RPC provider.
