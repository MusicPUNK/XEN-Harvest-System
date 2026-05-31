# XEN 一键收菜系统

XEN 一键收菜系统 is a local automation and review tool for XEN/CoinTool wallet operations. It imports a user-provided XEN workbook, classifies proxy-id ranges, compares sheet state with CoinTool on-chain mint counts, builds queue previews, and runs a browser-wallet dashboard for cautious manual execution.

The current build is deliberately conservative. Planned `mint`, plain `claim`, and `claim+remint` can generate CoinTool transaction previews and ask the browser wallet to sign sequential transactions. The backend never stores private keys or broadcasts autonomous transactions.

## Tech Stack

- Node.js ESM, requiring Node.js `>=22.22.0`.
- TypeScript syntax run directly by modern Node type stripping in `src/**/*.ts` and `tests/**/*.ts`.
- Native `node:test` test runner.
- Python `openpyxl` reader in `scripts/read_xlsx.py` for workbook parsing.
- SQLite CLI for local import/queue state.
- Browser dashboard served by Node's built-in HTTP server.
- Ethereum JSON-RPC calls for gas and CoinTool `map(address,bytes)` chain count checks.

## Main Features

- Imports workbook rows from Excel, Google Sheet export, or a locally synced Google Sheet cache.
- Parses closed proxy-id ranges, including newline-separated disjoint ranges.
- Treats proxy-id ranges as execution truth; workbook quantity cells are only accounting/reference notes.
- Classifies rows into `active_mint`, `claimable`, `claimed`, `planned_mint`, or `needs_review`.
- Ignores historical/analysis sheets that are not executable proxy-id records.
- Generates queues with planned mint batches of `50` ids and claim/remint batches of `100` ids.
- Checks CoinTool minted counts on-chain and reports sheet-vs-chain deltas per wallet.
- Builds CoinTool planned mint calldata for `t(uint256,bytes,bytes)`.
- Dashboard supports multi-transaction planned mint previews and sequential browser-wallet confirmations.
- Dashboard supports CoinTool-style manual claim and claim+remint batch selection, `F` remint label parsing, and Group Merge quantity previews without writing to Google Sheets.
- When `ETHERSCAN_API_KEY` is configured, the dashboard can pull CoinTool `T`/`F` transaction history, derive chain-side remint rounds per wallet-local id, and flag table-vs-chain round mismatches.

## Install Dependencies

```bash
npm install
```

Python must have `openpyxl` available, and the `sqlite3` CLI must be on PATH for database commands.

## Run Locally

Start the dashboard in public wallet-monitor mode:

```bash
npm run dashboard
```

The server listens on `127.0.0.1` by default and does not read a workbook unless you provide one.

Start the dashboard with your own Google Sheet URL or a local workbook:

```bash
node bin/xen-dashboard.mjs \
  --public false \
  --google-sheet-url "https://docs.google.com/spreadsheets/d/<spreadsheet-id>/edit"
```

```bash
node bin/xen-dashboard.mjs --public false --file "/path/to/workbook.xlsx"
```

Common environment variables:

```bash
RPC_URL="https://ethereum.publicnode.com"
MAX_FEE_GWEI="1"
COINTOOL_SALT_HEX="0x01"
ETHERSCAN_API_KEY="<optional-history-check-key>"
```

The default RPC is a public endpoint for trial use. For larger scans, set your own `RPC_URL`.

Sync a Google Sheet snapshot into the local cache after an authorized download URL is available:

```bash
node bin/xen-sync-google-cache.mjs --download-url "<authorized-temporary-download-url>"
```

Import and queue workbook data into SQLite:

```bash
node bin/xen-auto-mint.mjs import-excel --file "/path/to/workbook.xlsx" --db data/xen.sqlite --today 2026-05-05
node bin/xen-auto-mint.mjs queue --db data/xen.sqlite --claim-batch-size 100 --planned-mint-batch-size 50
node bin/xen-auto-mint.mjs verify --db data/xen.sqlite
```

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

- `bin/` - CLI entrypoints for import/queue/dashboard/cache sync.
- `src/importer.ts` - workbook row classification.
- `src/queue.ts` - queue chunking rules for planned mint and claim/remint.
- `src/action-preview.ts` - planned mint, selected claim, and selected claim+remint preview generation.
- `src/template.ts` - CoinTool calldata decoding/building helpers.
- `src/chain.ts` - CoinTool chain count RPC calls.
- `src/dashboard-data.ts` - dashboard summary and per-wallet rows.
- `src/dashboard-server.ts` - HTTP API and static dashboard server.
- `public/` - dashboard HTML/CSS/JS.
- `tests/` - Node test coverage for import, queue, cache, chain, dashboard, and calldata behavior.
- `scripts/` - Node version check, workbook reader, and optional local service helpers.
- `data/`, `outputs/`, and `memory/` - local/generated/private runtime files; intentionally ignored by Git.

## Security Model

- The backend does not store private keys or seed phrases.
- The backend does not sign transactions.
- The browser wallet is the only signer.
- Workbook files and synced caches are local runtime data and should not be committed.
- Public RPC endpoints are useful for testing, but users with many wallets should configure their own RPC provider.
