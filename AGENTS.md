# AGENTS.md - XEN 一键收菜系统

## Project Goal

Build a cautious local tool for XEN/CoinTool operations. The app imports a user-provided workbook, classifies proxy-id ranges, compares workbook state with on-chain CoinTool counts, previews safe batches, and asks the user's browser wallet to sign transactions.

## Safety Rules

- Never store private keys, seed phrases, or wallet passwords.
- Never sign or broadcast transactions from the backend.
- All executable actions must go through browser-wallet confirmation.
- Treat chain state as the execution source of truth for claim/remint eligibility.
- Treat workbook dates and quantities as planning/reference data, not execution truth.
- Derive execution quantities from proxy-id ranges.
- Keep generated caches, databases, logs, workbooks, and local memory files out of Git.

## Public Release Rules

- Do not commit real Google Sheet IDs, local filesystem paths, workbook caches, SQLite databases, generated reports, `.env` files, logs, `node_modules`, or memory files.
- Keep example configuration generic and placeholder-based.
- The public dashboard must be usable with a local Excel workbook, a user-provided Google Sheet URL, or public wallet monitoring.
- Default RPC may be a public endpoint for trial use, but users should be able to provide their own `RPC_URL`.

## Commands

```bash
npm install
npm run test
npm run check:dashboard-js
```

Run the dashboard in public monitor mode:

```bash
npm run dashboard
```

Run with a local workbook:

```bash
node bin/xen-dashboard.mjs --public false --file "/path/to/workbook.xlsx"
```

Run with a Google Sheet export URL or spreadsheet URL:

```bash
node bin/xen-dashboard.mjs --public false --google-sheet-url "https://docs.google.com/spreadsheets/d/<spreadsheet-id>/edit"
```

## Current Constraints

- Planned mint batches default to `50`.
- Claim/remint batches default to `100`.
- Do not change those defaults unless the user explicitly asks.
- Do not add backend signing or private-key storage.
