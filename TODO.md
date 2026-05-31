# TODO

## Completed

- Built workbook import and classification for active, claimable, claimed, planned mint, and review rows.
- Added proxy-id range parsing, including newline-separated ranges.
- Changed execution/statistics logic to trust proxy-id ranges instead of workbook quantity cells.
- Added queue generation with separate defaults: planned mint `50`, claim/remint `100`.
- Added Google Sheet cache sync support for user-provided workbook snapshots.
- Added local dashboard with wallet summaries, gas display, chain count checks, and manual action rows.
- Added CoinTool `map(address,bytes)` chain count verification.
- Added planned mint calldata generation for CoinTool `t(uint256,bytes,bytes)`.
- Added `/api/actions/mint-preview` for planned mint transaction previews.
- Added frontend flow for sequential browser-wallet confirmations for planned mint.
- Removed term-days input from normal mint UI; mint derives term from workbook expiry.
- Added `F`/`FF` remint label parsing so chain execution uses the base numeric range while the page shows remint rounds.
- Added CoinTool-style manual claim+remint card selection with Group Merge quantity grouping and selected-batch preview/signing.
- Added claim-only selected-batch preview/signing through the browser wallet.
- Added CoinTool `T`/`F` transaction-history parsing and optional Etherscan-backed chain remint round checks; mismatched table-vs-chain rounds are flagged on batch cards.
- Added tests covering importer behavior, queue chunking, chain checks, dashboard API, cache sync, and planned mint previews.

## Unfinished

- `claim` and `claim+remint` execution now support selected mature batches through browser-wallet signing, but they do not write results back to Google Sheets.
- Executable claim/remint must continue to verify selected proxy ids on-chain before signing; workbook expiry/time data remains reference-only.
- Planned mint currently trusts workbook planned rows for term/expiry; future agents should keep chain checks around execution paths.
- No persistent transaction history beyond browser `localStorage` reminders.
- No production signer/keystore adapter exists. The backend must continue to hold no private keys.
- No lint/build scripts are configured.

## Known Bugs Or Risks

- Local setup depends on `npm`, Python `openpyxl`, and the `sqlite3` CLI being available on PATH.
- The dashboard can read Google Sheet data only through a synced authorized cache unless local Google auth or a readable export URL is provided.
- Chain remint round checks require `ETHERSCAN_API_KEY` or an injected transaction-history provider; without it, cards show unverified chain rounds.
- Workbook expiry dates and times are reference data only; transactions can land late, so executable claim/remint logic must use chain truth.
- Browser-wallet transaction submission can stop midway if the user rejects one signature or the wallet/RPC fails. There is no resumable sent-transaction ledger yet.
- The repository root is the parent workspace, which contains unrelated local files. Future commits must avoid staging private/generated files outside this project directory.

## Next Development Steps

1. Add optional Google Sheet writeback after manual review, if the user later wants it.
2. Add richer claim/claim+remint recovery for partially signed selected batches.
3. Add a transaction ledger for browser-wallet sends so interrupted multi-transaction sessions can be resumed or audited.
4. Add lint and build scripts, then wire them into `package.json`.
5. Add a documented local Google auth or connector-assisted cache refresh workflow so dashboard data refresh is less manual.
6. Add UI states for partial success, failed signature, retry, and confirmed-on-chain tracking.
