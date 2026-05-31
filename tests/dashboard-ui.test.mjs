import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../public/dashboard.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../public/dashboard.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/dashboard.css", import.meta.url), "utf8");

test("dashboard title uses moon branding with animated rocket and fixed return button", () => {
  assert.match(html, /XEN 一键收菜系统/);
  assert.match(html, /class="rocket-badge"/);
  assert.match(html, /id="scrollTopButton" class="scroll-top-button" type="button" hidden/);
  assert.match(js, /scrollToTop\(\)/);
  assert.match(css, /\.rocket-badge\s*\{/);
  assert.match(css, /@keyframes rocketFlame/);
  assert.match(css, /\.app-shell\s*\{[^}]*--topbar-pad:\s*12px;/s);
  assert.match(css, /\.app-shell\s*\{[^}]*--topbar-gutter:\s*max\(20px, calc\(\(100vw - 1500px\) \/ 2\)\);/s);
  assert.match(css, /\.topbar\s*\{[^}]*position:\s*sticky;/s);
  assert.match(css, /\.topbar\s*\{[^}]*top:\s*0;/s);
  assert.match(css, /\.topbar\s*\{[^}]*z-index:\s*100;/s);
  assert.match(css, /\.topbar\s*\{[^}]*width:\s*100vw;/s);
  assert.match(css, /\.topbar\s*\{[^}]*margin-top:\s*calc\(-1 \* var\(--topbar-pad\)\);/s);
  assert.match(css, /\.topbar\s*\{[^}]*margin-left:\s*calc\(50% - 50vw\);/s);
  assert.match(css, /\.topbar\s*\{[^}]*padding:\s*var\(--topbar-pad\) var\(--topbar-gutter\);/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.app-shell\s*\{[^}]*--topbar-pad:\s*8px;[\s\S]*--topbar-gutter:\s*10px;/);
  assert.match(css, /\.scroll-top-button\s*\{[^}]*position:\s*fixed;/s);
  assert.match(css, /\.scroll-top-button\[hidden\]\s*\{/);
});

test("claim remint console matches the requested main/sidebar layout", () => {
  assert.match(html, /<div class="console-layout">/);
  assert.match(html, /<div class="console-toolbar">/);
  assert.match(html, /<div class="hero-metric">/);
  assert.match(html, /<span>合并分组<\/span>/);
  assert.match(html, /<span>单笔提交上限<\/span>/);
  assert.match(html, /<span>预计提交笔数<\/span>/);
  assert.match(html, /<div class="console-action-row">/);
  assert.match(html, /id="consoleMergeBar" class="console-merge-bar"/);
  assert.match(html, /id="consoleSelectedGroups"/);
  assert.match(html, /id="consoleSelectedQuantity"/);
  assert.match(html, /<div class="console-side-cards">/);
  assert.ok(html.indexOf('id="consoleTermField"') < html.indexOf('id="consoleExpiryField"'));
  assert.ok(html.indexOf('id="consoleExpiryField"') < html.indexOf('class="hero-metric"'));
  assert.ok(html.indexOf('class="console-action-row"') < html.indexOf('id="consoleMergeBar"'));
  assert.ok(html.indexOf('id="consoleMergeBar"') < html.indexOf('id="consoleBatchSelector"'));
  assert.ok(html.indexOf('<aside class="console-side">') < html.indexOf('id="consoleSubmitLimitField"'));
  assert.ok(html.indexOf('id="consoleSubmitLimitField"') < html.indexOf('id="consoleTxCount"'));
  assert.ok(html.indexOf('id="consoleTxCount"') < html.indexOf('<h2>拆单预览</h2>'));
  assert.match(css, /\.console-layout\s*\{/);
  assert.match(css, /\.console-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(360px, 0\.42fr\)/s);
  assert.match(css, /\.console-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.console-side-cards\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.mode-button\[data-console-mode="claimRemint"\]\.active\s*\{[^}]*background:\s*var\(--lime\);[^}]*color:\s*var\(--ink\);/s);
  assert.match(css, /\.mode-button\[data-console-mode="all"\]\.active\s*\{[^}]*background:\s*var\(--ink\);[^}]*color:\s*#fff9ea;/s);
  assert.match(css, /\.console-action-row\s*\{/);
  assert.match(css, /\.console-merge-bar\s*\{/);
  assert.match(css, /#startClaimRemintButton\s*\{[^}]*min-width:\s*220px;/s);
  assert.match(css, /#startClaimRemintButton\s*\{[^}]*max-width:\s*100%;/s);
  assert.match(css, /#startClaimRemintButton\s*\{[^}]*white-space:\s*normal;/s);
  assert.match(css, /#startClaimRemintButton\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
  assert.doesNotMatch(html, /console-action-card/);
  assert.doesNotMatch(css, /\.console-action-card\s*\{/);
  assert.doesNotMatch(html, /class="kpi-grid"/);
  assert.doesNotMatch(html, /class="wallet-table"/);
  assert.doesNotMatch(html, /id="walletRows"/);
  assert.doesNotMatch(html, /id="claimableList"/);
  assert.doesNotMatch(html, /id="dueSoonList"/);
  assert.doesNotMatch(html, /id="plannedList"/);
  assert.doesNotMatch(html, /id="actionReminderList"/);
  assert.doesNotMatch(html, /id="operationModal"/);
  assert.doesNotMatch(html, /wallet-selected-readonly/);
  assert.doesNotMatch(html, /已连接钱包/);
  assert.doesNotMatch(css, /\.console-toolbar \.console-heading/);
});

test("hero metric does not show selected group details", () => {
  assert.match(html, /<small id="consoleRange" hidden><\/small>/);
  assert.match(css, /\.hero-metric small\s*\{[^}]*display:\s*none;/s);
  assert.match(js, /elements\.consoleMetricLabel\.textContent = isAllView \? "已种编号" : \(isClaimOnly \? "可收数量" : "可复投数量"\);/);
  assert.match(js, /elements\.consoleSelectedGroups\.textContent = `已选 \$\{number\(selectedGroups\.length\)\} 组 \/ 共 \$\{number\(groups\.length\)\} 组`;/);
  assert.match(js, /elements\.consoleSelectedQuantity\.textContent = `已选 \$\{number\(selectedCount\)\} 个地址`;/);
  assert.match(js, /elements\.consoleRange\.hidden = true;/);
  assert.match(js, /\$\{number\(selectedCount\)\}\/\$\{number\(executableCount\)\}/);
  assert.doesNotMatch(js, /\$\{number\(selectedCount\)\} \/ \$\{number\(executableCount\)\} 个/);
  assert.doesNotMatch(js, /已选分组：/);
});

test("wallet controls use compact address and icon management buttons", () => {
  assert.match(js, /elements\.connectWalletButton\.innerHTML = connectedWalletLabel\(state\.connectedWallet\);/);
  assert.doesNotMatch(html, /consoleWalletControl/);
  assert.doesNotMatch(html, /consoleConnectedWallet/);
  assert.doesNotMatch(js, /consoleWalletControl/);
  assert.doesNotMatch(js, /consoleConnectedWallet/);
  assert.doesNotMatch(js, /walletMenuAnchor/);
  assert.doesNotMatch(js, /handleWalletButtonClick/);
  assert.doesNotMatch(js, /walletButtonElements/);
  assert.match(js, /class="wallet-connect-name"/);
  assert.match(js, /class="wallet-connect-divider"/);
  assert.match(js, /class="wallet-connect-address"/);
  assert.match(js, /function walletButtonAddress\(wallet\)/);
  assert.match(js, /return `\.\.\.\$\{wallet\.slice\(-4\)\}`;/);
  assert.doesNotMatch(js, /return `\$\{name\} \| \$\{shortWallet\(wallet\)\}`;/);
  assert.match(js, /const monitoredWalletStorageKey = "xenPublicMonitoredWallets";/);
  assert.match(js, /localStorage\.removeItem\(legacyMonitoredWalletStorageKey\);/);
  assert.match(html, /class="gas-pill"[^>]*href="https:\/\/etherscan\.io\/gastracker"/);
  assert.ok(html.indexOf('id="refreshButton"') < html.indexOf('id="walletControl"'));
  assert.match(html, /id="refreshButton"[^>]*>刷新<\/button>/);
  assert.doesNotMatch(html, /刷新链上<\/button>/);
  assert.match(html, /<h2>钱包管理<\/h2>/);
  assert.doesNotMatch(html, /钱包状态/);
  assert.doesNotMatch(html, /<span>全部钱包<\/span>/);
  assert.match(html, /id="addWalletButton"[^>]*aria-label="增加监控钱包"[^>]*>\+<\/button>/);
  assert.match(html, /id="deleteWalletButton"[^>]*aria-label="删除监控钱包"[^>]*>−<\/button>/);
  assert.match(css, /\.wallet-connect-button\.connected\s*\{[^}]*padding:\s*0 14px;/s);
  assert.match(css, /--soft-green:\s*#d8f8c2;/);
  assert.match(css, /\.wallet-connect-button\.connected\s*\{[^}]*background:\s*var\(--paper\);/s);
  assert.match(css, /\.wallet-connect-button\.connected\s*\{[^}]*color:\s*var\(--ink\);/s);
  assert.match(css, /\.wallet-connect-name\s*\{[^}]*font-size:\s*16px;/s);
  assert.match(css, /\.wallet-connect-divider\s*\{/);
  assert.match(css, /\.wallet-connect-divider\s*\{[^}]*font-size:\s*16px;/s);
  assert.match(css, /\.wallet-connect-address\s*\{[^}]*font-size:\s*16px;/s);
  assert.doesNotMatch(css, /console-wallet-control/);
  assert.doesNotMatch(css, /console-connected-wallet/);
  assert.match(css, /\.wallet-manage-actions\s*\{[^}]*inline-flex/s);
  assert.match(css, /\.wallet-manage-actions button\s*\{[^}]*width:\s*40px;/s);
});

test("connected wallet stamp switches before dashboard reload", () => {
  assert.match(js, /function renderConnectedWalletStamp\(\)/);
  assert.match(js, /renderWalletSpread\(state\.payload\.data, calculateTodayActionStats\(state\.payload\.data\)\);/);
  assert.match(js, /function setConnectedWallet\(wallet, providerKey = state\.selectedProviderKey\)[\s\S]*renderConnectedWalletStamp\(\);[\s\S]*loadDashboard\(\);/);
  assert.match(js, /async function disconnectWallet\(\)[\s\S]*renderConnectedWalletStamp\(\);[\s\S]*loadDashboard\(\);/);
});

test("wallet management cards fit five per desktop row", () => {
  assert.match(css, /\.wallet-spread-grid\s*\{[^}]*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.wallet-spread-card\s*\{[^}]*min-height:\s*118px;/s);
  assert.match(css, /\.wallet-spread-primary strong\s*\{[^}]*font-size:\s*18px;/s);
  assert.match(css, /\.wallet-spread-stats\s*\{[^}]*grid-template-columns:\s*1fr;/s);
  assert.match(css, /\.mode-button\s*\{[^}]*min-width:\s*76px;/s);
});

test("wallet add and delete use an in-page modal instead of native dialogs", () => {
  assert.match(html, /id="walletModal" class="modal-backdrop"/);
  assert.match(html, /id="walletForm" class="modal wallet-modal"/);
  assert.match(html, /id="walletModalTitle"/);
  assert.match(html, /id="walletNameInput"/);
  assert.match(html, /id="walletNameInput"[^>]*placeholder="XEN 01"/);
  assert.match(html, /id="walletAddressInput"/);
  assert.match(html, /id="walletDeleteBody"/);
  assert.match(html, /id="walletModalError"/);
  assert.match(js, /function openWalletAddModal\(\)/);
  assert.match(js, /function openWalletDeleteModal\(key\)/);
  assert.match(js, /function handleWalletModalSubmit\(\)/);
  assert.doesNotMatch(js, /window\.prompt/);
  assert.doesNotMatch(js, /window\.confirm/);
  assert.match(css, /\.wallet-modal\s*\{/);
  assert.match(css, /\.wallet-modal-error\s*\{/);
  assert.match(css, /\.wallet-delete-card\s*\{/);
});

test("wallet cards expose chain minted data after refresh", () => {
  assert.match(js, /function walletMaturitySummary\(row\)/);
  assert.match(js, /function renderWalletNextMaturity\(summary, wallet\)/);
  assert.match(js, /renderWalletNextMaturity\(summary, wallet\)/);
  assert.match(js, /if \(wallet\.chainError\) \{/);
  assert.match(js, /return "到期读取失败";/);
  assert.match(js, /<span>已种 <strong>\$\{renderChainMinted\(wallet\)\}<\/strong><\/span>/);
  assert.match(js, /<span class="wallet-spread-claimable-stat">可复投 <strong>\$\{renderWalletClaimable\(wallet\)\}<\/strong><\/span>/);
  assert.match(css, /\.wallet-spread-stats \.wallet-spread-claimable-stat\s*\{[^}]*font-weight:\s*780;/s);
  assert.match(js, /<span>到期数量 <strong>\$\{renderWalletNextQuantity\(summary, wallet\)\}<\/strong><\/span>/);
  assert.match(js, /function walletMaturityFailed\(summary, wallet\)/);
});

test("wallet cards mark already claimable maturity as red expired status", () => {
  assert.match(js, /const matured = walletHasMatured\(summary, wallet\);/);
  assert.match(js, /matured \? "已到期"/);
  assert.match(js, /matured \? " matured-hot"/);
  assert.match(js, /const dueWithinSevenDays = !matured && !hasToday && isWithinLocalDays\(nextTime, 7\);/);
  assert.match(js, /const dueWithinFourteenDays = !matured && !hasToday && !dueWithinSevenDays && isWithinLocalDays\(nextTime, 14\);/);
  assert.match(js, /const chainNormal = !matured && !hasToday && !dueWithinSevenDays && !dueWithinFourteenDays && !wallet\.chainError && wallet\.chainStatus === "ok";/);
  assert.match(js, /const statusClass = chainNormal \? ` class="wallet-spread-status-chain-ok"` : "";/);
  assert.match(js, /function walletHasMatured\(summary, wallet\)/);
  assert.match(js, /return \(wallet\.claimable \?\? 0\) > 0 \|\| isPastUnlock\(summary\.nextTime\);/);
  assert.match(js, /function isPastUnlock\(isoDateTime\)/);
  assert.match(css, /\.wallet-spread-card\.matured-hot\s*\{/);
  assert.match(css, /\.wallet-spread-card\.matured-hot \.wallet-spread-card-head em\s*\{/);
  assert.match(css, /\.wallet-spread-card\.matured-hot \.wallet-spread-primary strong\s*\{/);
  assert.match(css, /\.wallet-spread-card-head em\.wallet-spread-status-chain-ok\s*\{[^}]*background:\s*var\(--soft-green\);/s);
});

test("dashboard refresh preserves last known public wallet ids after transient chain errors", () => {
  assert.match(js, /state\.payload = preserveDashboardPayload\(payload, state\.payload\);/);
  assert.match(js, /function preserveDashboardPayload\(nextPayload, previousPayload\)/);
  assert.match(js, /preserveDashboardRecords\(nextPayload\.data\.allMint, previousPayload\.data\.allMint, staleWalletKeys\);/);
  assert.match(js, /if \(row\.chainStatus === "error" && row\.chainMinted == null\) \{/);
  assert.match(js, /return Boolean\(wallet && wallet\.chainMinted != null\);/);
});

test("gas text keeps three decimals for low gas prices", () => {
  assert.match(js, /gas\.snapshot\.gasPriceGwei\.toFixed\(3\)/);
  assert.doesNotMatch(js, /gas\.snapshot\.gasPriceGwei\.toFixed\(2\)/);
});

test("dashboard status banner is removed from the UI", () => {
  assert.doesNotMatch(html, /id="statusLine"/);
  assert.doesNotMatch(js, /statusLine/);
  assert.doesNotMatch(js, /正在读取钱包和链上数据/);
  assert.doesNotMatch(js, /读取失败：/);
  assert.doesNotMatch(css, /\.status-line/);
  assert.doesNotMatch(css, /statusPulse/);
});

test("wallet monitor local storage is reconciled with source wallets", () => {
  assert.match(js, /const sourceWalletsByKey = new Map\(wallets\.map\(\(wallet\) => \[walletMonitorKey\(wallet\), wallet\]\)\);/);
  assert.match(js, /\.map\(\(item\) => sourceWalletsByKey\.get\(walletMonitorKey\(item\)\)\)/);
  assert.match(js, /const hasStaleWallets = syncedWallets\.length !== state\.monitoredWallets\.length;/);
  assert.match(js, /if \(syncedWallets\.length === 0 \|\| hasStaleWallets\) \{/);
  assert.match(js, /state\.monitoredWallets = wallets\.map\(monitoredWalletFromSource\);/);
  assert.match(js, /function monitoredWalletFromSource\(wallet\)/);
});

test("claim-only page reuses selectable grouped batches without term days", () => {
  assert.match(js, /function renderClaimConsole\(payload\)/);
  assert.match(js, /renderActionConsole\(payload, "claim"\)/);
  assert.match(js, /elements\.consoleTermField\.hidden = mode === "claim" \|\| isAllView;/);
  assert.match(js, /elements\.consoleMergeBar\.hidden = false;/);
  assert.match(js, /elements\.consoleMergeField\.hidden = false;/);
  assert.match(js, /elements\.consoleSubmitLimitField\.hidden = false;/);
  assert.match(js, /elements\.consoleExpiryField\.hidden = isClaimOnly \|\| isAllView;/);
  assert.match(js, /renderSelectableBatchSelector\(groups, selectedGroups, mode, isAllView, nearestDueDay\)/);
  assert.match(js, /sendClaimTransactions\(\)/);
  assert.match(js, /requestClaimPreview\(sheet/);
  assert.doesNotMatch(js, /recordConsoleClaimReminder/);
});

test("claim console can switch between claimable and all grouped records", () => {
  assert.match(html, /data-console-mode="claimRemint"[^>]*>可复投<\/button>/);
  assert.match(html, /data-console-mode="claim"[^>]*>可收<\/button>/);
  assert.match(html, /data-console-mode="mint"[^>]*>新种<\/button>/);
  assert.match(html, /data-console-mode="all"[^>]*>查看全部<\/button>/);
  assert.match(html, /class="mode-button-group"/);
  assert.match(html, /class="mode-button-divider"/);
  assert.ok(html.indexOf('data-console-mode="mint"') < html.indexOf('class="mode-button-divider"'));
  assert.ok(html.indexOf('class="mode-button-divider"') < html.indexOf('data-console-mode="all"'));
  assert.match(html, /id="consoleMergeSizeInput"[^>]*value="100"/);
  assert.match(html, /id="consoleSelectAllField" class="console-toolbar-check"/);
  assert.match(html, /选中全部/);
  assert.match(html, /id="consoleDueWeekField" class="console-toolbar-check" hidden/);
  assert.match(html, /查看最近到期/);
  assert.doesNotMatch(html, /data-console-list-mode/);
  assert.doesNotMatch(html, /data-console-list-mode="claimable"/);
  assert.doesNotMatch(html, /<button class="list-mode-button[^"]*"[^>]*>可复投<\/button>/);
  assert.doesNotMatch(js, /consoleListMode/);
  assert.match(js, /renderAllConsole\(payload\)/);
  assert.match(js, /claimRecordRowsForSelectedWallet\(mode\)/);
  assert.match(js, /const isAllView = mode === "all";/);
  assert.match(js, /recordIsExecutable\(record\)/);
  assert.match(js, /selectableBatchCard\(group, selectedKeys\.has\(group\.key\), mode, isAllView, nearestDueDay\)/);
  assert.match(js, /groupRecordsByQuantity\(records, mergeSize\)/);
  assert.match(js, /isAllView \? \[\] : selectedClaimGroupsForSelectedWallet\(groups\)/);
  assert.match(js, /function setAllExecutableClaimGroups\(selected\)/);
  assert.match(js, /elements\.consoleSelectAllCheckbox\.indeterminate/);
  assert.match(js, /function nearestGroupDueDay\(groups\)/);
  assert.match(js, /state\.viewNearestDueDayOnly/);
  assert.match(js, /scrollToFirstNearestDueCard/);
  assert.match(js, /<article class="claim-address-card view-only/);
  assert.match(js, /data-nearest-due="true"/);
  assert.doesNotMatch(js, /viewAllDueSevenDaysOnly/);
  assert.doesNotMatch(js, /groupDueWithinSevenDays/);
  assert.match(js, /\.sort\(recordIdSort\)/);
  assert.doesNotMatch(js, /expandAllMintAddresses/);
  assert.doesNotMatch(css, /\.console-list-mode-switch\s*\{/);
  assert.match(css, /\.claim-address-card\.view-only::before\s*\{[^}]*display:\s*none;/s);
  assert.match(css, /\.claim-address-card\.view-only\.nearest-due-highlight/);
  assert.match(css, /\.mode-button\[data-console-mode="all"\]\.active/);
  assert.match(css, /\.split-mode-switch\s*\{/);
  assert.match(css, /\.mode-button-all\s*\{/);
  assert.match(css, /\.claim-address-card\.not-executable\s*\{/);
});

test("group merge updates from the input without a visible refresh button", () => {
  assert.doesNotMatch(html, /consoleMergeRefreshButton/);
  assert.match(html, /id="consoleMergeField" class="console-merge-field"/);
  assert.match(html, /<span>合并分组<\/span>/);
  assert.match(html, /id="consoleSubmitLimitField" class="console-field console-submit-limit-field"/);
  assert.doesNotMatch(js, /consoleMergeRefreshButton/);
});

test("legacy hidden panels and modal execution path are removed from the script", () => {
  assert.doesNotMatch(js, /walletRows/);
  assert.doesNotMatch(js, /claimableList/);
  assert.doesNotMatch(js, /dueSoonList/);
  assert.doesNotMatch(js, /plannedList/);
  assert.doesNotMatch(js, /actionReminderList/);
  assert.doesNotMatch(js, /operationModal/);
  assert.doesNotMatch(js, /openOperationModal/);
  assert.doesNotMatch(js, /sendMintTransaction/);
  assert.doesNotMatch(js, /recordCurrentOperation/);
  assert.doesNotMatch(js, /renderReminders/);
  assert.doesNotMatch(js, /xenManualActionReminders/);
});

test("single submit limit is separate from group merge and drives preview transactions", () => {
  assert.match(html, /单笔提交上限/);
  assert.match(html, /预计提交笔数/);
  assert.match(html, /consoleSubmitLimitInput/);
  assert.match(js, /readConsoleSubmitLimit\(\)/);
  assert.match(js, /transactionGroupsForSelectedGroups\(selectedGroups, submitLimit\)/);
  assert.match(js, /submitLimit/);
});

test("mint page exposes single submit limit and sends it to mint preview", () => {
  assert.match(html, /id="consoleGrid" class="console-grid"/);
  assert.match(html, /id="consoleMintRangeField" class="console-stat console-mint-range-field" hidden/);
  assert.match(html, /<span>预期 Mint 编号<\/span>/);
  assert.match(html, /id="consoleMintRange"/);
  assert.match(css, /\.console-grid\.mint-mode #consoleMintField\s*\{[^}]*grid-column:\s*2;/s);
  assert.match(css, /\.console-grid\.mint-mode #consoleMintRangeField\s*\{[^}]*grid-column:\s*3;/s);
  assert.match(css, /\.console-grid\.mint-mode \.console-action-row\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*2;[^}]*flex-direction:\s*column;[^}]*justify-content:\s*flex-end;/s);
  assert.match(js, /elements\.consoleGrid\.classList\.add\("mint-mode"\);/);
  assert.match(js, /elements\.consoleGrid\.classList\.remove\("mint-mode"\);/);
  assert.match(js, /elements\.consoleMintRangeField\.hidden = false;/);
  assert.match(js, /elements\.consoleMintRange\.textContent = planCount > 0 \? formatIdRange\(idStart, idEnd\) : "-";/);
  assert.match(js, /function renderMintConsole\(payload\)[\s\S]*elements\.consoleSubmitLimitField\.hidden = false;/);
  assert.match(js, /function renderMintConsole\(payload\)[\s\S]*elements\.consoleMergeBar\.hidden = true;/);
  assert.match(js, /function renderMintConsole\(payload\)[\s\S]*elements\.consoleHint\.hidden = true;/);
  assert.match(js, /function renderMintConsole\(payload\)[\s\S]*const submitLimit = readConsoleSubmitLimit\(\);/);
  assert.match(js, /function renderMintConsole\(payload\)[\s\S]*mintPreviewRows\(idStart, planCount, submitLimit\)/);
  assert.match(js, /requestMintPreview\(wallet\.sheet, \{ wallet: wallet\.wallet, plannedCount, termDays, submitLimit \}\)/);
});

test("mint console follows the connected wallet instead of a stale selected wallet", () => {
  assert.match(js, /function syncSelectedSheetForConsole\(wallets, payload\)/);
  assert.match(js, /if \(connectedWallet\) \{/);
  assert.match(js, /state\.selectedSheet = connectedWallet\.sheet;/);
  assert.match(js, /syncSelectedSheetForConsole\(wallets, payload\);/);
});

test("claim and all consoles follow the connected wallet instead of showing another wallet", () => {
  assert.match(js, /function syncSelectedSheetForConsole\(wallets, payload\)/);
  assert.match(js, /if \(connectedWallet\) \{/);
  assert.match(js, /state\.selectedSheet = connectedWallet\.sheet;/);
  assert.doesNotMatch(js, /if \(state\.consoleMode === "mint" && connectedWallet\) \{/);
});

test("console expiry uses the current local day for projections", () => {
  assert.match(js, /function consoleToday\(\)/);
  assert.match(js, /addDaysIso\(consoleToday\(\), termDays\)/);
});

test("chain unlock times render in the user UTC+8 timezone", () => {
  assert.match(js, /const userDisplayTimeZone = "Asia\/Shanghai";/);
  assert.match(js, /timeZone: userDisplayTimeZone/);
  assert.match(js, /function localDateTimeParts\(date\)/);
  assert.match(js, /function formatDateTime\(isoDateTime\)[\s\S]*localDateTimeParts\(new Date\(isoDateTime\)\)/);
  assert.doesNotMatch(js, /date\.getHours\(\)/);
});

test("mint expiry date can reverse-fill term days and displays weekday", () => {
  assert.match(html, /id="consoleExpiryDateButton" class="console-expiry-date-button"/);
  assert.match(html, /id="consoleExpiryDateInput" type="date"/);
  assert.match(html, /id="consoleExpiryWeekday"/);
  assert.doesNotMatch(html, /id="consoleMaxTermButton"/);
  assert.match(html, /id="consoleExpiryCalendar" class="console-expiry-calendar" hidden/);
  assert.match(js, /consoleExpiryDateButton: document\.querySelector\("#consoleExpiryDateButton"\)/);
  assert.match(js, /consoleExpiryDateInput: document\.querySelector\("#consoleExpiryDateInput"\)/);
  assert.match(js, /consoleExpiryWeekday: document\.querySelector\("#consoleExpiryWeekday"\)/);
  assert.match(js, /consoleExpiryCalendar: document\.querySelector\("#consoleExpiryCalendar"\)/);
  assert.match(js, /elements\.consoleExpiryDateButton\.addEventListener\("click", \(\) => openConsoleExpiryDatePicker\(\)\);/);
  assert.match(js, /elements\.consoleExpiryCalendar\.addEventListener\("click", \(event\) => \{/);
  assert.match(js, /setConsoleTermDays\(readConsoleMaxMintTermDays\(\)\);/);
  assert.match(js, /elements\.consoleExpiryDateInput\.addEventListener\("change", \(\) => \{/);
  assert.match(js, /setConsoleTermDays\(daysBetweenIso\(consoleToday\(\), elements\.consoleExpiryDateInput\.value\)\);/);
  assert.match(js, /elements\.consoleExpiry\.textContent = expiryDate \? formatDate\(expiryDate\) : "-";/);
  assert.match(js, /elements\.consoleExpiryWeekday\.textContent = expiryDate \? formatWeekday\(expiryDate\) : "";/);
  assert.match(js, /function openConsoleExpiryDatePicker\(\)/);
  assert.match(js, /function renderConsoleExpiryCalendar\(selectedDate\)/);
  assert.match(js, /data-calendar-action="max"/);
  assert.match(js, /data-calendar-action="prevYear"/);
  assert.match(js, /data-calendar-action="nextYear"/);
  assert.match(js, />最长期限<\/button>/);
  assert.match(js, /const startOffset = \(firstDay\.getUTCDay\(\) \+ 6\) % 7;/);
  assert.match(js, /<span>一<\/span><span>二<\/span><span>三<\/span><span>四<\/span><span>五<\/span><span>六<\/span><span>日<\/span>/);
  assert.doesNotMatch(js, /data-calendar-action="clear"/);
  assert.doesNotMatch(js, /data-calendar-action="today"/);
  assert.match(js, /class="console-calendar-footer-action"/);
  assert.match(js, /function setConsoleTermDays\(termDays\)/);
  assert.match(js, /function formatWeekday\(isoDate\)/);
  assert.match(css, /\.console-expiry-date-button\s*\{/);
  assert.match(css, /\.console-expiry-date-button\s*\{[^}]*white-space:\s*nowrap;/s);
  assert.match(css, /\.console-expiry-date-button\s*\{[^}]*border:\s*2px solid var\(--line\);/s);
  assert.match(css, /\.console-expiry-date-button em\s*\{[^}]*color:\s*var\(--ink\);[^}]*font-size:\s*16px;/s);
  assert.match(css, /\.console-expiry-calendar\s*\{/);
  assert.match(css, /\.console-expiry-calendar\s*\{[^}]*width:\s*min\(260px, calc\(100vw - 72px\)\);/s);
  assert.match(css, /\.console-expiry-calendar\s*\{[^}]*background:\s*var\(--paper\);/s);
  assert.match(css, /\.console-expiry-calendar\s*\{[^}]*border:\s*2px solid var\(--line\);/s);
  assert.match(css, /\.console-expiry-calendar button\s*\{[^}]*border:\s*0;/s);
  assert.match(css, /\.console-calendar-header\s*\{[^}]*grid-template-columns:\s*22px 22px minmax\(0, 1fr\) 22px 22px;/s);
  assert.match(css, /\.console-calendar-weekdays span\s*\{[^}]*display:\s*grid;/s);
  assert.match(css, /\.console-calendar-days\s*\{[^}]*grid-template-columns:\s*repeat\(7, 1fr\);/s);
  assert.match(css, /\.console-expiry-calendar \.console-calendar-day\s*\{[^}]*height:\s*23px;[^}]*font-size:\s*13px;/s);
  assert.match(css, /\.console-expiry-calendar \.console-calendar-day\.selected\s*\{[^}]*background:\s*var\(--lime\);/s);
  assert.match(css, /\.console-expiry-calendar \.console-calendar-footer-action\s*\{[^}]*background:\s*var\(--lime\);[^}]*color:\s*var\(--ink\);/s);
  assert.match(css, /\.console-expiry-calendar \.console-calendar-footer-action\s*\{[^}]*padding:\s*3px 8px;[^}]*font-size:\s*13px;[^}]*font-weight:\s*760;/s);
  assert.doesNotMatch(css, /\.console-max-term-button/);
  assert.match(css, /\.console-expiry-date-button input\[type="date"\]\s*\{/);
});

test("mint term and expiry date are capped at the XEN max mint term", () => {
  assert.match(js, /function readConsoleMaxMintTermDays\(\)/);
  assert.match(js, /return state\.payload\?\.data\?\.metadata\?\.maxMintTermDays \?\? 488;/);
  assert.match(js, /function clampMintTermDays\(termDays\)/);
  assert.match(js, /Math\.min\(readConsoleMaxMintTermDays\(\), Math\.max\(1, Number\.parseInt\(termDays, 10\) \|\| 1\)\)/);
  assert.match(js, /elements\.consoleTermInput\.max = String\(maxMintTermDays\);/);
  assert.match(js, /elements\.consoleExpiryDateInput\.max = addDaysIso\(consoleToday\(\), maxMintTermDays\);/);
  assert.match(js, /const termDays = clampMintTermDays\(elements\.consoleTermInput\.value\);/);
  assert.match(js, /elements\.consoleTermInput\.value = String\(termDays\);/);
});

test("claim/remint cards show compact round and chain information without sheet-dependent wording", () => {
  assert.match(js, /function selectableBatchCard\(group, checked, mode = "claimRemint", isAllView = false, nearestDueDay = null\)/);
  assert.match(js, /chainRoundDisplay\(parts\)/);
  assert.doesNotMatch(js, /class="claim-address-card-round"/);
  assert.match(js, /const statusText = isAllView \? groupStatusLabel\(group, mode\) : chainRoundText;/);
  assert.match(js, /const maturityText = isAllView \? groupMaturityTimeText\(group\) : group\.timeText;/);
  assert.match(js, /return "链上状态: 已校验";/);
  assert.doesNotMatch(js, /链上轮次: 未校验/);
  assert.doesNotMatch(js, /const statusText = isAllView \? groupStatusText\(group, mode\) : chainRoundText;/);
  assert.match(css, /\.claim-address-card-chain\.round-mismatch/);
});

test("selectable group cards are compact with five-column desktop layout", () => {
  assert.match(css, /\.console-batch-card-grid\s*\{[^}]*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.claim-address-card\s*\{[^}]*min-height:\s*92px;/s);
  assert.match(css, /\.claim-range-label\s*\{[^}]*font-size:\s*14px;/s);
  assert.match(css, /\.claim-address-card-meta\s*\{[^}]*font-size:\s*12px;/s);
  assert.match(css, /\.claim-address-card-chain\s*\{[^}]*font-size:\s*12px;/s);
  assert.match(css, /\.scroll-top-button\s*\{[^}]*right:\s*auto;/s);
  assert.match(js, /<div class="claim-address-card-chain\$\{group\.hasRoundMismatch \? " round-mismatch" : ""\}">\$\{escapeHtml\(statusText\)\}<\/div>\s*<div class="claim-address-card-meta">\s*<span>\$\{escapeHtml\(maturityText\)\}<\/span>\s*<\/div>/);
});

test("execution logs and wallet cards highlight important status without selection borders", () => {
  assert.match(js, /function highlightExecutionMessage\(message\)/);
  assert.match(js, /<strong>\$1<\/strong>/);
  assert.match(css, /\.execution-log strong\s*\{/);
  assert.match(js, /wallet-connected-stamp"><span>已连接<\/span><\/div>/);
  assert.doesNotMatch(js, /<strong>WALLET<\/strong>/);
  assert.match(css, /\.wallet-connected-stamp\s*\{/);
  assert.match(css, /\.wallet-connected-stamp\s*\{[^}]*width:\s*72px;/s);
  assert.match(css, /\.wallet-connected-stamp\s*\{[^}]*height:\s*72px;/s);
  assert.match(css, /\.wallet-connected-stamp\s*\{[^}]*border-radius:\s*50%;/s);
  assert.match(css, /\.wallet-connected-stamp\s*\{[^}]*rgba\(255, 232, 232, 0\.78\) 0 45%/s);
  assert.doesNotMatch(css, /\.wallet-connected-stamp\s*\{[^}]*rgba\(255, 253, 244, 0\.82\) 0 45%/s);
  assert.match(css, /\.wallet-connected-stamp\s*\{[^}]*transform:\s*rotate\(-6deg\);/s);
  assert.match(css, /\.wallet-connected-stamp::before\s*\{/);
  assert.doesNotMatch(css, /\.wallet-connected-stamp::after/);
  assert.doesNotMatch(css, /\.wallet-connected-stamp span\s*\{[^}]*border-bottom:/s);
  assert.match(css, /\.wallet-connected-stamp span\s*\{[^}]*font-size:\s*13px;/s);
  assert.match(css, /\.wallet-connected-stamp span\s*\{[^}]*width:\s*42px;/s);
  assert.match(css, /\.wallet-connected-stamp span\s*\{[^}]*letter-spacing:\s*0;/s);
  assert.doesNotMatch(css, /\.wallet-connected-stamp span\s*\{[^}]*transform:/s);
  assert.match(css, /\.wallet-connected-stamp span\s*\{[^}]*white-space:\s*nowrap;/s);
  assert.doesNotMatch(css, /\.wallet-connected-stamp strong/);
  assert.doesNotMatch(css, /\.wallet-spread-card\.selected\s*\{/);
  assert.match(css, /\.wallet-spread-card\s*\{[^}]*cursor:\s*default;/s);
});

test("return-to-top button appears only after long group lists and reveals the wallet management edge", () => {
  assert.match(js, /function positionScrollTopButton\(\)/);
  assert.match(js, /document\.querySelector\("\.console-main"\)/);
  assert.match(js, /window\.addEventListener\("scroll", positionScrollTopButton, \{ passive: true \}\);/);
  assert.match(js, /const cardRows = batchCardRowCount\(cards\);/);
  assert.match(js, /if \(cardRows <= 10 \|\| window\.scrollY < tenthRowOffset\) \{/);
  assert.match(js, /elements\.scrollTopButton\.hidden = true;/);
  assert.match(js, /elements\.scrollTopButton\.hidden = false;/);
  assert.match(js, /elements\.scrollTopButton\.style\.left = `\$\{Math\.round\(rect\.right - buttonWidth\)\}px`;/);
  assert.match(js, /state\.viewNearestDueDayOnly = false;/);
  assert.match(js, /elements\.consoleDueWeekCheckbox\.checked = false;/);
  assert.match(js, /const walletSection = document\.querySelector\("\.wallet-spread-section"\);/);
  assert.match(js, /window\.scrollY \+ walletSection\.getBoundingClientRect\(\)\.bottom - 10/);
  assert.match(js, /window\.scrollTo\(\{[\s\S]*behavior: "smooth"/);
  assert.match(js, /function batchCardRowCount\(cards\)/);
});

test("wallet transaction sending is centralized instead of duplicated per mode", () => {
  assert.match(js, /async function sendPreviewTransactions\(preview, options\)/);
  assert.equal((js.match(/eth_sendTransaction/g) ?? []).length, 1);
  assert.equal((js.match(/ensureConnectedWallet\(\)/g) ?? []).length, 2);
  assert.equal((js.match(/activeWalletProvider\(\)/g) ?? []).length, 2);
});

test("claim and remint sends wait for mined receipts before continuing", () => {
  assert.match(js, /const xenContractAddress = "0x06450dee7fd2fb8e39061434babcfc05599a6fb8";/);
  assert.match(js, /const txHash = await sendWalletTransaction\(ethereum, from, tx\);[\s\S]*const receipt = await waitForWalletTransactionReceipt\(ethereum, txHash, \{/);
  assert.match(js, /assertEffectfulReceipt\(preview, tx, receipt\);/);
  assert.match(js, /function waitForWalletTransactionReceipt\(ethereum, txHash/);
  assert.match(js, /method: "eth_getTransactionReceipt"/);
  assert.match(js, /Transaction confirmed, but some VMUs may have failed internally/);
});

test("wallet queue mode can burst-submit preview transactions to the wallet", () => {
  assert.doesNotMatch(html, /id="consoleWalletQueueCheckbox"/);
  assert.doesNotMatch(html, /连续唤起钱包/);
  assert.doesNotMatch(js, /consoleWalletQueueCheckbox/);
  assert.match(js, /function shouldQueueWalletRequests\(\)/);
  assert.match(js, /sendQueuedPreviewTransactions\(preview, options, ethereum, from\)/);
  assert.match(js, /const walletQueueConcurrency = 20;/);
  assert.match(js, /return \["mint", "claimRemint"\]\.includes\(state\.consoleMode\);/);
  assert.match(js, /function updateQueuedWalletProgress\(progress\)/);
  assert.match(js, /签名 \$\{number\(progress\.signedCount\)\}\/\$\{number\(progress\.totalCount\)\}/);
  assert.doesNotMatch(js, /Pending \$\{number\(progress\.pendingOperationIds\.size\)\}/);
  assert.match(js, /queuedProgress\.signedCount \+= 1;/);
  assert.match(js, /queuedProgress\.pendingOperationIds\.add\(tx\.operationId\);/);
  assert.match(js, /等待钱包队列：共 \$\{number\(preview\.transactionCount\)\} 笔，每次最多 \$\{number\(queueLimit\)\} 笔/);
  assert.match(js, /updateQueuedWalletProgress\(queuedProgress\)/);
  assert.match(js, /唤起钱包 \$\{number\(tx\.index\)\}\/\$\{number\(preview\.transactionCount\)\}/);
  assert.doesNotMatch(js, /Pending \$\{number\(tx\.index\)/);
  assert.doesNotMatch(js, /已唤起 \$\{number\(launchedCount\)\}/);
  assert.match(js, /队列中断 \$\{number\(tx\.index\)\}\/\$\{number\(preview\.transactionCount\)\}/);
});

test("wallet queue waits for mined receipts before marking queued transactions complete", () => {
  assert.match(js, /async function sendQueuedPreviewTransactions\(preview, options, ethereum, from\)[\s\S]*const receipt = await waitForWalletTransactionReceipt\(ethereum, txHash/);
  assert.match(js, /assertEffectfulReceipt\(preview, tx, receipt\);[\s\S]*completedCount \+= 1;/);
});

test("wallet execution uses operation ids, a runner lock, and durable duplicate guards", () => {
  assert.match(js, /const transactionRecordStorageKey = "xenTransactionRecords";/);
  assert.match(js, /const operationSendCounts = new Map\(\);/);
  assert.match(js, /queueRunnerActive: false,/);
  assert.match(js, /async function withQueueRunnerLock\(callback\)/);
  assert.match(js, /function assertOperationCanSubmit\(tx\)/);
  assert.match(js, /function isTransactionRecordBlocking\(existing\)/);
  assert.match(js, /existing\.status === "Signing" && !existing\.txHash/);
  assert.match(js, /Duplicate submission detected\. Execution stopped to prevent repeated gas charges\./);
  assert.match(js, /localStorage\.setItem\(transactionRecordStorageKey/);
  assert.match(js, /tx\.operationId/);
  assert.match(js, /console\.log\("\[xen tx submit\]"/);
  assert.match(js, /recordTransactionStatus\(tx, "Signing"/);
  assert.match(js, /recordTransactionStatus\(tx, "Submitted"/);
  assert.match(js, /recordTransactionStatus\(tx, "Ready"/);
});

test("wallet receipt classification separates partial errors, failed, and not-propagated states", () => {
  assert.match(js, /const transactionStatusMessages = \{/);
  assert.match(js, /"Confirmed Success": "Transaction confirmed\. Expected XEN transfers detected\."/);
  assert.match(js, /"Partial Error": "Transaction confirmed, but some VMUs may have failed internally\. Gas was charged\. Please verify the VMU status before retrying\."/);
  assert.match(js, /"Failed": "Transaction failed on-chain\. Gas was still charged\."/);
  assert.match(js, /"Not Propagated": "Transaction hash was generated, but it is not visible on-chain yet\. It may not have been propagated\. Do not resubmit blindly; check nonce first\."/);
  assert.match(js, /"Pending": "Transaction is pending\. Do not submit another transaction with the same nonce unless replacing it\."/);
  assert.match(js, /"Cancelled": "Wallet signature was rejected\. No transaction was submitted\."/);
  assert.match(js, /function classifyTransactionReceipt\(preview, tx, receipt\)/);
  assert.match(js, /const expectedLogCount = tx\.expectedXenLogCount \?\? tx\.count;/);
  assert.match(js, /xenLogCount < expectedLogCount/);
  assert.match(js, /return "Partial Error";/);
  assert.match(js, /return "Confirmed Success";/);
});
