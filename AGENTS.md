# AGENTS.md - XEN 一键收菜系统

## Project Goal

Build a cautious local dashboard for XEN/CoinTool operations. The app monitors user-provided wallet addresses, scans chain state, previews safe batches, and asks the user's browser wallet to sign transactions.

## Safety Rules

- Never store private keys, seed phrases, or wallet passwords.
- Never sign or broadcast transactions from the backend.
- All executable actions must go through browser-wallet confirmation.
- Treat chain state as the execution source of truth for claim/remint eligibility.
- Derive execution quantities from proxy-id ranges.
- Keep generated caches, databases, logs, local runtime data, and memory files out of Git.

## Public Release Rules

- Do not commit real wallet lists, local filesystem paths, caches, SQLite databases, generated reports, `.env` files, logs, `node_modules`, or memory files.
- Keep example configuration generic and placeholder-based.
- The public dashboard must be usable through local public wallet monitoring.
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

## Current Constraints

- Planned mint batches default to `50`.
- Claim/remint batches default to `100`.
- Do not change those defaults unless the user explicitly asks.
- Do not add backend signing or private-key storage.
