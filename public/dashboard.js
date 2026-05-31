const elements = {
  walletControl: document.querySelector("#walletControl"),
  connectWalletButton: document.querySelector("#connectWalletButton"),
  walletMenu: document.querySelector("#walletMenu"),
  refreshButton: document.querySelector("#refreshButton"),
  consoleGas: document.querySelector("#consoleGas"),
  consoleGrid: document.querySelector("#consoleGrid"),
  consoleMetricLabel: document.querySelector("#consoleMetricLabel"),
  consoleClaimable: document.querySelector("#consoleClaimable"),
  consoleRange: document.querySelector("#consoleRange"),
  consoleTermField: document.querySelector("#consoleTermField"),
  consoleTermLabel: document.querySelector("#consoleTermLabel"),
  consoleTermInput: document.querySelector("#consoleTermInput"),
  consoleMintField: document.querySelector("#consoleMintField"),
  consoleMintCountInput: document.querySelector("#consoleMintCountInput"),
  consoleMintRangeField: document.querySelector("#consoleMintRangeField"),
  consoleMintRange: document.querySelector("#consoleMintRange"),
  consoleMergeBar: document.querySelector("#consoleMergeBar"),
  consoleMergeField: document.querySelector("#consoleMergeField"),
  consoleMergeSizeInput: document.querySelector("#consoleMergeSizeInput"),
  consoleSelectAllField: document.querySelector("#consoleSelectAllField"),
  consoleSelectAllCheckbox: document.querySelector("#consoleSelectAllCheckbox"),
  consoleDueWeekField: document.querySelector("#consoleDueWeekField"),
  consoleDueWeekCheckbox: document.querySelector("#consoleDueWeekCheckbox"),
  consoleSelectedGroups: document.querySelector("#consoleSelectedGroups"),
  consoleSelectedQuantity: document.querySelector("#consoleSelectedQuantity"),
  consoleSubmitLimitField: document.querySelector("#consoleSubmitLimitField"),
  consoleSubmitLimitInput: document.querySelector("#consoleSubmitLimitInput"),
  consoleTxCount: document.querySelector("#consoleTxCount"),
  consoleExpiryField: document.querySelector("#consoleExpiryField"),
  consoleExpiryLabel: document.querySelector("#consoleExpiryLabel"),
  consoleExpiry: document.querySelector("#consoleExpiry"),
  consoleExpiryDateButton: document.querySelector("#consoleExpiryDateButton"),
  consoleExpiryWeekday: document.querySelector("#consoleExpiryWeekday"),
  consoleExpiryDateInput: document.querySelector("#consoleExpiryDateInput"),
  consoleExpiryCalendar: document.querySelector("#consoleExpiryCalendar"),
  startClaimRemintButton: document.querySelector("#startClaimRemintButton"),
  consoleHint: document.querySelector("#consoleHint"),
  consoleBatchSelector: document.querySelector("#consoleBatchSelector"),
  batchPreviewList: document.querySelector("#batchPreviewList"),
  executionLog: document.querySelector("#executionLog"),
  sideBatchSizeLabel: document.querySelector("#sideBatchSizeLabel"),
  addWalletButton: document.querySelector("#addWalletButton"),
  deleteWalletButton: document.querySelector("#deleteWalletButton"),
  walletSpreadGrid: document.querySelector("#walletSpreadGrid"),
  walletModal: document.querySelector("#walletModal"),
  walletForm: document.querySelector("#walletForm"),
  walletModalTitle: document.querySelector("#walletModalTitle"),
  walletModalClose: document.querySelector("#walletModalClose"),
  walletModalCancel: document.querySelector("#walletModalCancel"),
  walletModalSubmit: document.querySelector("#walletModalSubmit"),
  walletAddFields: document.querySelector("#walletAddFields"),
  walletDeleteBody: document.querySelector("#walletDeleteBody"),
  walletNameInput: document.querySelector("#walletNameInput"),
  walletAddressInput: document.querySelector("#walletAddressInput"),
  walletModalError: document.querySelector("#walletModalError"),
  scrollTopButton: document.querySelector("#scrollTopButton"),
};

const legacyMonitoredWalletStorageKey = "xenMonitoredWallets";
const monitoredWalletStorageKey = "xenPublicMonitoredWallets";
const transactionRecordStorageKey = "xenTransactionRecords";
const walletProviderListeners = new WeakSet();
const operationSendCounts = new Map();
const walletQueueConcurrency = 20;
const xenContractAddress = "0x06450dee7fd2fb8e39061434babcfc05599a6fb8";
const walletReceiptPollMs = 5_000;
const walletReceiptMaxPolls = 180;
const walletReceiptNotPropagatedPolls = 12;
const duplicateSubmissionMessage = "Duplicate submission detected. Execution stopped to prevent repeated gas charges.";
const transactionBlockingStatuses = new Set([
  "Signing",
  "Submitted",
  "Pending",
  "Confirmed Success",
  "Partial Error",
  "Failed",
  "Not Propagated",
  "Need Check",
]);
const transactionStatusMessages = {
  "Confirmed Success": "Transaction confirmed. Expected XEN transfers detected.",
  "Partial Error": "Transaction confirmed, but some VMUs may have failed internally. Gas was charged. Please verify the VMU status before retrying.",
  "Failed": "Transaction failed on-chain. Gas was still charged.",
  "Not Propagated": "Transaction hash was generated, but it is not visible on-chain yet. It may not have been propagated. Do not resubmit blindly; check nonce first.",
  "Pending": "Transaction is pending. Do not submit another transaction with the same nonce unless replacing it.",
  "Cancelled": "Wallet signature was rejected. No transaction was submitted.",
};
const userDisplayTimeZone = "Asia/Shanghai";
const userDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: userDisplayTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const userDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: userDisplayTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const state = {
  payload: null,
  connectedWallet: null,
  walletProviders: [],
  selectedProviderKey: null,
  walletMenuOpen: false,
  manualWalletDisconnect: false,
  selectedSheet: null,
  consoleMode: "claimRemint",
  viewNearestDueDayOnly: false,
  consoleSubmitLimits: {
    claimRemint: 100,
    claim: 100,
    mint: null,
  },
  lastClaimRemintPreview: null,
  selectedClaimGroups: new Set(),
  consoleExpiryCalendarOpen: false,
  consoleExpiryCalendarMonth: null,
  monitoredWallets: loadMonitoredWallets(),
  expandedWalletSheet: null,
  walletDeleteMode: false,
  walletModalMode: null,
  walletModalDeleteKey: null,
  queueRunnerActive: false,
};

elements.connectWalletButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleWalletMenu();
});
elements.walletMenu.addEventListener("click", (event) => {
  event.stopPropagation();
  const providerButton = event.target.closest("[data-wallet-provider-key]");
  if (providerButton) {
    connectWallet(providerButton.dataset.walletProviderKey);
    return;
  }
  const actionButton = event.target.closest("[data-wallet-action]");
  if (actionButton?.dataset.walletAction === "disconnect") {
    disconnectWallet();
  }
});
document.addEventListener("click", (event) => {
  if (!elements.walletControl.contains(event.target)) {
    closeWalletMenu();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!elements.walletModal.hidden) {
      closeWalletModal();
      return;
    }
    closeWalletMenu();
  }
});
elements.refreshButton.addEventListener("click", () => loadDashboard());
elements.scrollTopButton.addEventListener("click", () => scrollToTop());
window.addEventListener("resize", positionScrollTopButton);
window.addEventListener("scroll", positionScrollTopButton, { passive: true });
elements.addWalletButton.addEventListener("click", () => openWalletAddModal());
elements.deleteWalletButton.addEventListener("click", () => {
  state.walletDeleteMode = !state.walletDeleteMode;
  if (state.payload) {
    renderWalletSpread(state.payload.data, calculateTodayActionStats(state.payload.data));
  }
});
elements.consoleTermInput.addEventListener("input", () => renderConsole(state.payload));
elements.consoleExpiryDateButton.addEventListener("click", () => openConsoleExpiryDatePicker());
elements.consoleExpiryCalendar.addEventListener("click", (event) => {
  const button = event.target.closest("[data-calendar-action], [data-calendar-date]");
  if (!button) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const action = button.dataset.calendarAction;
  if (["prevYear", "prev", "next", "nextYear"].includes(action)) {
    const delta = { prevYear: -12, prev: -1, next: 1, nextYear: 12 }[action];
    state.consoleExpiryCalendarMonth = shiftMonthKey(state.consoleExpiryCalendarMonth ?? consoleToday().slice(0, 7), delta);
    renderConsoleExpiryCalendar(elements.consoleExpiryDateInput.value);
    return;
  }
  if (action === "max") {
    const maxDate = addDaysIso(consoleToday(), readConsoleMaxMintTermDays());
    state.consoleExpiryCalendarMonth = maxDate.slice(0, 7);
    setConsoleTermDays(readConsoleMaxMintTermDays());
    return;
  }
  const isoDate = button.dataset.calendarDate;
  if (isoDate && !button.disabled) {
    state.consoleExpiryCalendarMonth = isoDate.slice(0, 7);
    setConsoleTermDays(daysBetweenIso(consoleToday(), isoDate));
  }
});
elements.consoleExpiryDateInput.addEventListener("change", () => {
  if (elements.consoleExpiryDateInput.value) {
    setConsoleTermDays(daysBetweenIso(consoleToday(), elements.consoleExpiryDateInput.value));
  } else {
    renderConsole(state.payload);
  }
});
document.addEventListener("click", (event) => {
  if (!state.consoleExpiryCalendarOpen || elements.consoleExpiryField.contains(event.target)) {
    return;
  }
  closeConsoleExpiryCalendar();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeConsoleExpiryCalendar();
  }
});
elements.consoleMintCountInput.addEventListener("input", () => renderConsole(state.payload));
elements.consoleMergeSizeInput.addEventListener("input", () => renderConsole(state.payload));
elements.consoleMergeSizeInput.addEventListener("change", () => {
  syncConsoleMergeInput({ normalize: true });
  renderConsole(state.payload);
});
elements.consoleMergeSizeInput.addEventListener("blur", () => {
  syncConsoleMergeInput({ normalize: true });
  renderConsole(state.payload);
});
elements.consoleSelectAllCheckbox.addEventListener("change", () => {
  setAllExecutableClaimGroups(elements.consoleSelectAllCheckbox.checked);
  renderConsole(state.payload);
});
elements.consoleDueWeekCheckbox.addEventListener("change", () => {
  state.viewNearestDueDayOnly = elements.consoleDueWeekCheckbox.checked;
  renderConsole(state.payload);
});
elements.consoleSubmitLimitInput.addEventListener("input", () => renderConsole(state.payload));
elements.consoleSubmitLimitInput.addEventListener("change", () => {
  syncConsoleSubmitLimitInput({ normalize: true });
  saveConsoleSubmitLimitForMode();
  renderConsole(state.payload);
});
elements.consoleSubmitLimitInput.addEventListener("blur", () => {
  syncConsoleSubmitLimitInput({ normalize: true });
  saveConsoleSubmitLimitForMode();
  renderConsole(state.payload);
});
elements.consoleBatchSelector.addEventListener("change", (event) => {
  const groupCheckbox = event.target.closest("[data-console-group-key]");
  if (groupCheckbox) {
    setClaimGroupSelection(groupCheckbox.dataset.consoleGroupKey, groupCheckbox.checked);
    renderConsole(state.payload);
  }
});
document.querySelectorAll("[data-console-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    saveConsoleSubmitLimitForMode();
    state.consoleMode = button.dataset.consoleMode;
    restoreConsoleSubmitLimitForMode();
    renderConsole(state.payload);
  });
});
elements.startClaimRemintButton.addEventListener("click", () => {
  if (state.consoleMode === "mint") {
    sendConsoleMintTransactions();
  } else if (state.consoleMode === "claim") {
    sendClaimTransactions();
  } else if (state.consoleMode === "all") {
    return;
  } else {
    sendClaimRemintTransactions();
  }
});
elements.walletSpreadGrid.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-monitor-remove]");
  if (removeButton) {
    if (state.walletDeleteMode) {
      openWalletDeleteModal(removeButton.dataset.monitorRemove);
    }
    return;
  }
  const card = event.target.closest("[data-wallet-card-sheet]");
  if (!card) {
    return;
  }
  state.expandedWalletSheet = card.dataset.walletCardSheet;
  state.selectedSheet = card.dataset.walletCardSheet;
  renderWalletSpread(state.payload.data, calculateTodayActionStats(state.payload.data));
  renderConsole(state.payload);
});
elements.walletModalClose.addEventListener("click", () => closeWalletModal());
elements.walletModalCancel.addEventListener("click", () => closeWalletModal());
elements.walletModal.addEventListener("click", (event) => {
  if (event.target === elements.walletModal) {
    closeWalletModal();
  }
});
elements.walletForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleWalletModalSubmit();
});
initWalletButton();
await loadDashboard();
positionScrollTopButton();
setInterval(() => {
  loadDashboard();
}, 60_000);

function initWalletButton() {
  renderWalletButton();
  if (typeof window === "undefined") {
    return;
  }
  window.addEventListener("eip6963:announceProvider", (event) => {
    registerWalletProvider(event.detail);
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  registerLegacyWalletProviders();
  setTimeout(() => {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    registerLegacyWalletProviders();
    renderWalletButton();
    renderWalletMenu();
  }, 250);
}

function registerLegacyWalletProviders() {
  const ethereum = window.ethereum;
  if (!ethereum?.request) {
    return;
  }
  const providers = Array.isArray(ethereum.providers) && ethereum.providers.length > 0
    ? ethereum.providers
    : [ethereum];
  for (const provider of providers) {
    registerWalletProvider({
      info: {
        uuid: `legacy:${detectWalletProviderName(provider).toLowerCase().replaceAll(/\s+/g, "-")}`,
        name: detectWalletProviderName(provider),
        icon: null,
      },
      provider,
    });
  }
}

function registerWalletProvider(detail) {
  const provider = detail?.provider;
  if (!provider?.request) {
    return;
  }
  const existing = state.walletProviders.find((item) => item.provider === provider);
  if (existing) {
    if (detail?.info?.name) {
      existing.name = detail.info.name;
    }
    if (detail?.info?.icon) {
      existing.icon = detail.info.icon;
    }
    renderWalletButton();
    renderWalletMenu();
    return;
  }
  const baseKey = detail?.info?.uuid ?? provider.uuid ?? `wallet:${detectWalletProviderName(provider)}`;
  const key = uniqueProviderKey(String(baseKey));
  const entry = {
    key,
    name: detail?.info?.name ?? detectWalletProviderName(provider),
    icon: detail?.info?.icon ?? null,
    provider,
  };
  state.walletProviders.push(entry);
  attachWalletProviderListeners(entry);
  syncProviderAccount(entry);
  renderWalletButton();
  renderWalletMenu();
}

function uniqueProviderKey(baseKey) {
  if (!state.walletProviders.some((item) => item.key === baseKey)) {
    return baseKey;
  }
  let index = 2;
  while (state.walletProviders.some((item) => item.key === `${baseKey}:${index}`)) {
    index += 1;
  }
  return `${baseKey}:${index}`;
}

function attachWalletProviderListeners(entry) {
  if (!entry.provider.on || walletProviderListeners.has(entry.provider)) {
    return;
  }
  walletProviderListeners.add(entry.provider);
  entry.provider.on("accountsChanged", (accounts) => {
    if (state.selectedProviderKey !== entry.key) {
      return;
    }
    const wallet = accounts?.[0] ?? null;
    if (wallet) {
      state.manualWalletDisconnect = false;
    }
    setConnectedWallet(wallet, entry.key);
  });
}

function syncProviderAccount(entry) {
  if (state.connectedWallet || state.manualWalletDisconnect) {
    return;
  }
  entry.provider.request({ method: "eth_accounts" })
    .then((accounts) => {
      const wallet = accounts?.[0] ?? null;
      if (wallet && !state.connectedWallet && !state.manualWalletDisconnect) {
        setConnectedWallet(wallet, entry.key);
      }
    })
    .catch(() => {
      // Some wallets reject passive account checks until the user explicitly connects.
    });
}

async function connectWallet(providerKey = null) {
  const entry = walletProviderEntry(providerKey) ?? walletProviderEntry(state.selectedProviderKey) ?? state.walletProviders[0] ?? null;
  if (!entry?.provider?.request) {
    alert("未检测到浏览器钱包。请先安装或打开 MetaMask/Rabby。");
    return null;
  }
  try {
    elements.connectWalletButton.disabled = true;
    elements.connectWalletButton.textContent = "连接中...";
    const accounts = await entry.provider.request({ method: "eth_requestAccounts" });
    const wallet = accounts?.[0] ?? null;
    if (!wallet) {
      throw new Error("钱包没有返回账户。");
    }
    state.manualWalletDisconnect = false;
    setConnectedWallet(wallet, entry.key);
    closeWalletMenu();
    return wallet;
  } catch (error) {
    alert(`钱包连接失败：${walletErrorMessage(error)}`);
    renderWalletButton();
    return null;
  } finally {
    elements.connectWalletButton.disabled = false;
  }
}

async function ensureConnectedWallet() {
  if (state.connectedWallet) {
    return state.connectedWallet;
  }
  if (state.walletProviders.length > 1 && !state.selectedProviderKey) {
    openWalletMenu();
    alert("请先在右上角选择要使用的钱包。");
    return null;
  }
  return connectWallet(state.selectedProviderKey);
}

async function disconnectWallet() {
  const entry = walletProviderEntry(state.selectedProviderKey);
  if (entry?.provider?.request) {
    try {
      await entry.provider.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // Not every wallet supports programmatic revoke; clearing the app session is enough here.
    }
  }
  state.manualWalletDisconnect = true;
  state.connectedWallet = null;
  state.selectedProviderKey = null;
  closeWalletMenu();
  renderWalletButton();
  renderConnectedWalletStamp();
  if (state.payload) {
    loadDashboard();
  }
}

function setConnectedWallet(wallet, providerKey = state.selectedProviderKey) {
  const previousWallet = state.connectedWallet;
  state.connectedWallet = wallet;
  if (wallet && providerKey) {
    state.selectedProviderKey = providerKey;
  }
  renderWalletButton();
  renderWalletMenu();
  renderConnectedWalletStamp();
  if (state.payload && previousWallet?.toLowerCase() !== wallet?.toLowerCase()) {
    loadDashboard();
  }
}

function renderConnectedWalletStamp() {
  if (!state.payload) {
    return;
  }
  renderWalletSpread(state.payload.data, calculateTodayActionStats(state.payload.data));
}

function renderWalletButton() {
  if (!elements.connectWalletButton) {
    return;
  }
  if (state.connectedWallet) {
    elements.connectWalletButton.innerHTML = connectedWalletLabel(state.connectedWallet);
    elements.connectWalletButton.classList.add("connected");
    elements.connectWalletButton.title = `已连接：${state.connectedWallet}`;
  } else {
    elements.connectWalletButton.textContent = state.walletProviders.length > 0 ? "选择钱包" : "连接钱包";
    elements.connectWalletButton.classList.remove("connected");
    elements.connectWalletButton.title = "连接浏览器钱包";
  }
  elements.connectWalletButton.setAttribute("aria-expanded", state.walletMenuOpen ? "true" : "false");
}

function connectedWalletLabel(wallet) {
  const row = wallet
    ? state.payload?.data?.wallets?.find((item) => item.wallet.toLowerCase() === wallet.toLowerCase())
    : null;
  const name = row?.sheet ?? row?.name ?? "钱包";
  return `<span class="wallet-connect-name">${escapeHtml(name)}</span><span class="wallet-connect-divider">|</span><span class="wallet-connect-address">${escapeHtml(walletButtonAddress(wallet))}</span>`;
}

function walletButtonAddress(wallet) {
  if (!wallet) {
    return "-";
  }
  return `...${wallet.slice(-4)}`;
}

function toggleWalletMenu() {
  state.walletMenuOpen = !state.walletMenuOpen;
  if (state.walletMenuOpen) {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    registerLegacyWalletProviders();
  }
  renderWalletButton();
  renderWalletMenu();
}

function openWalletMenu() {
  state.walletMenuOpen = true;
  renderWalletButton();
  renderWalletMenu();
}

function closeWalletMenu() {
  state.walletMenuOpen = false;
  renderWalletButton();
  renderWalletMenu();
}

function renderWalletMenu() {
  if (!elements.walletMenu) {
    return;
  }
  elements.walletMenu.hidden = !state.walletMenuOpen;
  if (!state.walletMenuOpen) {
    return;
  }
  const connectedProvider = walletProviderEntry(state.selectedProviderKey);
  const providerList = state.walletProviders.length > 0
    ? `<div class="wallet-provider-list">${state.walletProviders.map((provider) => walletProviderOption(provider)).join("")}</div>`
    : `<div class="wallet-menu-empty">没有检测到可用钱包。请确认钱包插件已开启。</div>`;
  elements.walletMenu.innerHTML = `
    <div class="wallet-menu-section">
      ${state.connectedWallet ? `
        <div class="wallet-account-card">
          <span>当前连接</span>
          <strong>${escapeHtml(shortWallet(state.connectedWallet))}</strong>
          <small>${escapeHtml(connectedProvider?.name ?? "浏览器钱包")} · ${escapeHtml(state.connectedWallet)}</small>
        </div>
      ` : ""}
      <div class="wallet-menu-title">
        <span>${state.connectedWallet ? "切换钱包" : "选择钱包"}</span>
        <strong>${number(state.walletProviders.length)}</strong>
      </div>
      ${providerList}
    </div>
    ${state.connectedWallet ? `<button class="wallet-menu-disconnect" type="button" data-wallet-action="disconnect">退出钱包</button>` : ""}
  `;
}

function walletProviderOption(provider) {
  const active = provider.key === state.selectedProviderKey;
  return `
    <button class="wallet-provider-option${active ? " active" : ""}" type="button" data-wallet-provider-key="${escapeHtml(provider.key)}">
      ${walletProviderIcon(provider)}
      <span class="wallet-provider-name">
        <strong>${escapeHtml(provider.name)}</strong>
        <small>${active && state.connectedWallet ? escapeHtml(shortWallet(state.connectedWallet)) : "点击连接"}</small>
      </span>
      ${active && state.connectedWallet ? `<span class="wallet-provider-current">已连接</span>` : ""}
    </button>
  `;
}

function walletProviderIcon(provider) {
  if (provider.icon) {
    return `<img class="wallet-provider-icon" src="${escapeHtml(provider.icon)}" alt="" />`;
  }
  return `<span class="wallet-provider-fallback">${escapeHtml(provider.name.slice(0, 1).toUpperCase())}</span>`;
}

function walletProviderEntry(key) {
  if (!key) {
    return null;
  }
  return state.walletProviders.find((item) => item.key === key) ?? null;
}

function activeWalletProvider() {
  return walletProviderEntry(state.selectedProviderKey)?.provider ?? null;
}

function detectWalletProviderName(provider) {
  if (provider?.isOkxWallet || provider?.isOKExWallet) {
    return "OKX Wallet";
  }
  if (provider?.isRabby) {
    return "Rabby";
  }
  if (provider?.isOneKey) {
    return "OneKey";
  }
  if (provider?.isCoinbaseWallet) {
    return "Coinbase Wallet";
  }
  if (provider?.isTrust || provider?.isTrustWallet) {
    return "Trust Wallet";
  }
  if (provider?.isTokenPocket) {
    return "TokenPocket";
  }
  if (provider?.isBitKeep || provider?.isBitgetWallet) {
    return "Bitget";
  }
  if (provider?.isBinance || provider?.isBinanceWallet) {
    return "Binance Web3";
  }
  if (provider?.isMetaMask) {
    return "MetaMask";
  }
  return "Browser Wallet";
}

async function loadDashboard(options = {}) {
  elements.refreshButton.disabled = true;
  try {
    const params = new URLSearchParams();
    if (options.refreshGoogle) {
      params.set("refreshGoogle", "1");
    }
    if (state.connectedWallet) {
      params.set("connectedWallet", state.connectedWallet);
    }
    if (state.monitoredWallets.length > 0) {
      params.set("wallets", JSON.stringify(state.monitoredWallets.map((item) => ({
        name: item.name,
        wallet: item.wallet,
      }))));
    }
    const url = `/api/dashboard${params.toString() ? `?${params.toString()}` : ""}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    state.payload = preserveDashboardPayload(payload, state.payload);
    renderDashboard(payload);
    positionScrollTopButton();
  } catch (error) {
    console.warn("Dashboard refresh failed", error);
  } finally {
    elements.refreshButton.disabled = false;
  }
}

function preserveDashboardPayload(nextPayload, previousPayload) {
  if (!nextPayload?.data || !previousPayload?.data) {
    return nextPayload;
  }
  const previousWallets = new Map(previousPayload.data.wallets.map((wallet) => [walletDashboardKey(wallet), wallet]));
  const staleWalletKeys = new Set();
  for (const wallet of nextPayload.data.wallets) {
    const previousWallet = previousWallets.get(walletDashboardKey(wallet));
    if (!previousWallet) {
      continue;
    }
    if (wallet.chainStatus === "error" && wallet.chainMinted == null) {
      if (previousWallet.chainMinted != null) {
        wallet.chainMinted = previousWallet.chainMinted;
        wallet.sheetMintedIds = previousWallet.sheetMintedIds;
        wallet.chainDelta = previousWallet.chainDelta;
        staleWalletKeys.add(walletDashboardKey(wallet));
      }
    }
  }
  if (staleWalletKeys.size > 0) {
    preserveDashboardRecords(nextPayload.data.allMint, previousPayload.data.allMint, staleWalletKeys);
  }
  return nextPayload;
}

function preserveDashboardRecords(nextRecords, previousRecords, staleWalletKeys) {
  const nextWalletKeys = new Set(nextRecords.map((record) => walletDashboardKey(record)));
  for (const record of previousRecords) {
    const key = walletDashboardKey(record);
    if (staleWalletKeys.has(key) && !nextWalletKeys.has(key)) {
      nextRecords.push(record);
      nextWalletKeys.add(key);
    }
  }
}

function walletDashboardKey(row) {
  return `${row.sheet}:${String(row.wallet).toLowerCase()}`;
}

function renderDashboard(payload) {
  const { data } = payload;
  const todayStats = calculateTodayActionStats(data);
  renderWalletButton();
  renderConsole(payload);
  renderWalletSpread(data, todayStats);
}

function calculateTodayActionStats(data) {
  const records = todayActionRecords(data);
  const walletSheets = [...new Set(records.map((record) => record.sheet))];
  return {
    records,
    quantity: sum(records, "quantity"),
    rowCount: records.length,
    walletSheets,
  };
}

function todayActionRecords(data) {
  const todayRows = data.dueSoon.filter((record) => isTodayUnlock(record.unlockTime));
  return dedupeRecords([...data.claimable, ...todayRows]);
}

function renderWalletSpread(data, todayStats) {
  syncMonitoredWallets(data.wallets);
  const monitoredKeys = new Set(state.monitoredWallets.map((item) => item.key));
  const visibleWallets = data.wallets
    .filter((wallet) => monitoredKeys.has(walletMonitorKey(wallet)))
    .sort(walletSpreadSort);
  const walletCards = visibleWallets.length > 0
    ? visibleWallets.map((wallet) => walletSpreadCard(wallet, todayStats)).join("")
    : `<div class="empty">暂无监控钱包，点击右上角“增加”。</div>`;
  renderWalletManageButtons(visibleWallets);
  elements.walletSpreadGrid.classList.toggle("delete-mode", state.walletDeleteMode);
  elements.walletSpreadGrid.innerHTML = walletCards;
}

function renderWalletManageButtons(visibleWallets) {
  elements.deleteWalletButton.disabled = visibleWallets.length === 0;
  if (visibleWallets.length === 0) {
    state.walletDeleteMode = false;
  }
  elements.addWalletButton.textContent = "+";
  elements.deleteWalletButton.textContent = "−";
  elements.addWalletButton.title = "增加监控钱包";
  elements.addWalletButton.setAttribute("aria-label", "增加监控钱包");
  elements.deleteWalletButton.title = state.walletDeleteMode ? "取消删除模式" : "删除监控钱包";
  elements.deleteWalletButton.setAttribute("aria-label", state.walletDeleteMode ? "取消删除模式" : "删除监控钱包");
  elements.deleteWalletButton.classList.toggle("active", state.walletDeleteMode);
}

function syncMonitoredWallets(wallets) {
  if (wallets.length === 0) {
    return;
  }
  const sourceWalletsByKey = new Map(wallets.map((wallet) => [walletMonitorKey(wallet), wallet]));
  const syncedWallets = state.monitoredWallets
    .map((item) => sourceWalletsByKey.get(walletMonitorKey(item)))
    .filter(Boolean)
    .map((wallet) => monitoredWalletFromSource(wallet));
  const hasStaleWallets = syncedWallets.length !== state.monitoredWallets.length;

  if (syncedWallets.length === 0 || hasStaleWallets) {
    state.monitoredWallets = wallets.map(monitoredWalletFromSource);
    saveMonitoredWallets();
    return;
  }

  const changed = JSON.stringify(syncedWallets) !== JSON.stringify(state.monitoredWallets);
  state.monitoredWallets = syncedWallets;
  if (changed) {
    saveMonitoredWallets();
  }
}

function monitoredWalletFromSource(wallet) {
  return {
    key: walletMonitorKey(wallet),
    name: wallet.sheet,
    wallet: wallet.wallet,
  };
}

function openWalletAddModal() {
  state.walletModalMode = "add";
  state.walletModalDeleteKey = null;
  elements.walletModalTitle.textContent = "新增钱包";
  elements.walletAddFields.hidden = false;
  elements.walletDeleteBody.hidden = true;
  elements.walletDeleteBody.innerHTML = "";
  elements.walletNameInput.value = "";
  elements.walletAddressInput.value = "";
  elements.walletModalSubmit.textContent = "确定";
  elements.walletModalSubmit.classList.remove("danger-button");
  clearWalletModalError();
  elements.walletModal.hidden = false;
  elements.walletNameInput.focus();
}

function openWalletDeleteModal(key) {
  const wallet = state.monitoredWallets.find((item) => item.key === key);
  if (!wallet) {
    return;
  }
  state.walletModalMode = "delete";
  state.walletModalDeleteKey = key;
  elements.walletModalTitle.textContent = "删除钱包";
  elements.walletAddFields.hidden = true;
  elements.walletDeleteBody.hidden = false;
  elements.walletDeleteBody.innerHTML = `
    <div class="wallet-delete-card">
      <span>将停止监控这个钱包</span>
      <strong>${escapeHtml(wallet.name || shortWallet(wallet.wallet))}</strong>
      <code>${escapeHtml(shortWallet(wallet.wallet))}</code>
    </div>
    <p class="modal-note">确认后只会从当前页面监控列表移除，不会影响链上资产。</p>
  `;
  elements.walletModalSubmit.textContent = "确认删除";
  elements.walletModalSubmit.classList.add("danger-button");
  clearWalletModalError();
  elements.walletModal.hidden = false;
  elements.walletModalSubmit.focus();
}

function closeWalletModal() {
  elements.walletModal.hidden = true;
  state.walletModalMode = null;
  state.walletModalDeleteKey = null;
  clearWalletModalError();
}

function handleWalletModalSubmit() {
  if (state.walletModalMode === "delete") {
    removeMonitoredWallet(state.walletModalDeleteKey);
    closeWalletModal();
    return;
  }
  addMonitoredWalletFromModal();
}

function addMonitoredWalletFromModal() {
  const name = elements.walletNameInput.value.trim();
  const wallet = elements.walletAddressInput.value.trim();
  if (!name) {
    showWalletModalError("请填写钱包名称。");
    elements.walletNameInput.focus();
    return;
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    showWalletModalError("钱包地址格式不正确，请输入完整 0x 地址。");
    elements.walletAddressInput.focus();
    return;
  }
  const key = wallet.toLowerCase();
  if (state.monitoredWallets.some((item) => item.key === key)) {
    showWalletModalError("这个钱包已经在监控列表里。");
    elements.walletAddressInput.focus();
    return;
  }
  state.monitoredWallets.push({ key, name, wallet });
  saveMonitoredWallets();
  closeWalletModal();
  if (state.payload) {
    loadDashboard();
  }
}

function removeMonitoredWallet(key) {
  const wallet = state.monitoredWallets.find((item) => item.key === key);
  state.monitoredWallets = state.monitoredWallets.filter((item) => item.key !== key);
  if (wallet?.name === state.expandedWalletSheet) {
    state.expandedWalletSheet = null;
  }
  if (wallet?.name === state.selectedSheet) {
    state.selectedSheet = null;
  }
  saveMonitoredWallets();
  if (state.payload) {
    loadDashboard();
  }
}

function showWalletModalError(message) {
  elements.walletModalError.textContent = message;
  elements.walletModalError.hidden = false;
}

function clearWalletModalError() {
  elements.walletModalError.textContent = "";
  elements.walletModalError.hidden = true;
}

function walletMonitorKey(wallet) {
  return String(wallet.wallet ?? wallet.key ?? "").toLowerCase();
}

function walletSpreadCard(wallet, todayStats) {
  const summary = walletMaturitySummary(wallet);
  const nextTime = summary.nextTime;
  const matured = walletHasMatured(summary, wallet);
  const hasToday = !matured && isTodayUnlock(nextTime);
  const dueWithinSevenDays = !matured && !hasToday && isWithinLocalDays(nextTime, 7);
  const dueWithinFourteenDays = !matured && !hasToday && !dueWithinSevenDays && isWithinLocalDays(nextTime, 14);
  const connected = state.connectedWallet?.toLowerCase() === wallet.wallet.toLowerCase();
  const chainNormal = !matured && !hasToday && !dueWithinSevenDays && !dueWithinFourteenDays && !wallet.chainError && wallet.chainStatus === "ok";
  const statusLabel = matured ? "已到期" : hasToday ? "今日到期" : dueWithinSevenDays ? "7 天内到期" : dueWithinFourteenDays ? "14 天内到期" : wallet.chainError ? "查询失败" : chainNormal ? "链上正常" : "待查询";
  const statusClass = chainNormal ? ` class="wallet-spread-status-chain-ok"` : "";
  return `
    <article class="wallet-spread-card${matured ? " matured-hot" : ""}${hasToday ? " today-hot" : ""}${dueWithinSevenDays ? " week-hot" : ""}${dueWithinFourteenDays ? " next-week-hot" : ""}${connected ? " connected-wallet" : ""}" data-wallet-card-sheet="${escapeHtml(wallet.sheet)}">
      <div class="wallet-spread-card-head">
        <div>
          <strong>${escapeHtml(wallet.sheet)}</strong>
          <span>${escapeHtml(shortWallet(wallet.wallet))}</span>
        </div>
        <div class="wallet-spread-card-state">
          <em${statusClass}>${statusLabel}</em>
          <button class="wallet-spread-card-remove" type="button" data-monitor-remove="${escapeHtml(walletMonitorKey(wallet))}" aria-label="删除 ${escapeHtml(wallet.sheet)} 监控" title="删除监控">×</button>
        </div>
      </div>
      <div class="wallet-spread-primary">
        <span>下次到期</span>
        <strong>${renderWalletNextMaturity(summary, wallet)}</strong>
      </div>
      <div class="wallet-spread-stats">
        <span>已种 <strong>${renderChainMinted(wallet)}</strong></span>
        <span class="wallet-spread-claimable-stat">可复投 <strong>${renderWalletClaimable(wallet)}</strong></span>
        <span>到期数量 <strong>${renderWalletNextQuantity(summary, wallet)}</strong></span>
      </div>
      ${connected ? `<div class="wallet-connected-stamp"><span>已连接</span></div>` : ""}
    </article>
  `;
}

function walletSpreadSort(a, b) {
  const aSummary = walletMaturitySummary(a);
  const bSummary = walletMaturitySummary(b);
  return (
    (aSummary.nextTime ?? "9999-12-31T23:59:59.999Z").localeCompare(bSummary.nextTime ?? "9999-12-31T23:59:59.999Z") ||
    a.sheet.localeCompare(b.sheet)
  );
}

function walletMaturitySummary(row) {
  if (row.nextUnlockTime) {
    return { nextTime: row.nextUnlockTime, nextQuantity: row.nextUnlockQuantity ?? 0 };
  }
  const records = walletMaturityRecords(row);
  if (records.length === 0) {
    return { nextTime: row.nextExpiryDate ? `${row.nextExpiryDate}T00:00:00.000Z` : null, nextQuantity: row.nextUnlockQuantity ?? 0 };
  }
  const first = records[0];
  const firstTime = first.unlockTime ?? first.expiryDate;
  const firstDay = localDateKey(new Date(firstTime));
  const nextQuantity = records
    .filter((record) => localDateKey(new Date(record.unlockTime ?? record.expiryDate)) === firstDay)
    .reduce((total, record) => total + (record.quantity ?? 0), 0);
  return { nextTime: firstTime, nextQuantity };
}

function renderWalletNextMaturity(summary, wallet) {
  if (summary.nextTime) {
    return formatDateTime(summary.nextTime);
  }
  if (wallet.chainError) {
    return "到期读取失败";
  }
  if (wallet.chainStatus === "ok") {
    return "暂无到期数据";
  }
  return "读取中";
}

function renderWalletClaimable(wallet) {
  if (walletMaturityFailed(null, wallet) && (wallet.claimable ?? 0) === 0) {
    return `<span class="chain-error">失败</span>`;
  }
  return number(wallet.claimable);
}

function renderWalletNextQuantity(summary, wallet) {
  if (walletMaturityFailed(summary, wallet)) {
    return `<span class="chain-error">失败</span>`;
  }
  return number(summary.nextQuantity);
}

function walletMaturityFailed(summary, wallet) {
  return Boolean(wallet.chainError && !summary?.nextTime);
}

function walletHasMatured(summary, wallet) {
  return (wallet.claimable ?? 0) > 0 || isPastUnlock(summary.nextTime);
}

function walletMaturityRecords(row) {
  const data = state.payload?.data;
  if (!data) {
    return [];
  }
  return dedupeRecords([
    ...(data.claimable ?? []),
    ...(data.dueSoon ?? []),
    ...(data.allMint ?? []),
  ].filter((record) => record.sheet === row.sheet && (record.unlockTime || record.expiryDate)))
    .sort(recordTimeSort);
}

function selectedWalletActionSheet(visibleWallets = state.payload?.data?.wallets ?? []) {
  const visibleSheets = new Set(visibleWallets.map((wallet) => wallet.sheet));
  if (state.expandedWalletSheet && visibleSheets.has(state.expandedWalletSheet)) {
    return state.expandedWalletSheet;
  }
  if (state.selectedSheet && visibleSheets.has(state.selectedSheet)) {
    return state.selectedSheet;
  }
  return visibleWallets[0]?.sheet ?? "";
}

function todayWalletCount(sheet, todayStats) {
  return todayStats.records
    .filter((record) => record.sheet === sheet)
    .reduce((total, record) => total + record.quantity, 0);
}

function renderConsole(payload) {
  if (!payload) {
    return;
  }
  const wallets = payload.data.wallets;
  syncSelectedSheetForConsole(wallets, payload);
  renderModeButtons();
  if (state.consoleMode === "mint") {
    renderMintConsole(payload);
  } else if (state.consoleMode === "all") {
    renderAllConsole(payload);
  } else if (state.consoleMode === "claim") {
    renderClaimConsole(payload);
  } else {
    renderClaimRemintConsole(payload);
  }
  requestAnimationFrame(positionScrollTopButton);
}

function syncSelectedSheetForConsole(wallets, payload) {
  const connectedWallet = connectedWalletRow(wallets);
  if (connectedWallet) {
    state.selectedSheet = connectedWallet.sheet;
    return;
  }
  if (!state.selectedSheet || !wallets.some((wallet) => wallet.sheet === state.selectedSheet)) {
    state.selectedSheet = preferredWalletForMode(wallets, payload)?.sheet ?? wallets[0]?.sheet ?? "";
  }
}

function connectedWalletRow(wallets) {
  if (!state.connectedWallet) {
    return null;
  }
  return wallets.find((wallet) => wallet.wallet.toLowerCase() === state.connectedWallet.toLowerCase()) ?? null;
}

function preferredWalletForMode(wallets, payload) {
  if (wallets.length === 0) {
    return null;
  }
  if (state.consoleMode === "mint") {
    const connected = state.connectedWallet
      ? wallets.find((wallet) => wallet.wallet.toLowerCase() === state.connectedWallet.toLowerCase())
      : null;
    return connected ?? wallets.find((wallet) => wallet.chainStatus === "ok" && wallet.chainMinted != null) ?? wallets[0];
  }
  const todayStats = payload?.data ? calculateTodayActionStats(payload.data) : { records: [] };
  return (
    wallets.find((wallet) => wallet.claimable > 0) ??
    wallets.find((wallet) => todayWalletCount(wallet.sheet, todayStats) > 0) ??
    wallets[0]
  );
}

function renderClaimRemintConsole(payload) {
  renderActionConsole(payload, "claimRemint");
}

function renderClaimConsole(payload) {
  renderActionConsole(payload, "claim");
}

function renderAllConsole(payload) {
  renderActionConsole(payload, "all");
}

function renderActionConsole(payload, mode) {
  const wallet = selectedWalletRow();
  const isAllView = mode === "all";
  const records = claimRecordRowsForSelectedWallet(mode);
  const executableRecords = claimableRecordsForSelectedWallet();
  const claimableCount = sum(records, "quantity");
  const executableCount = sum(executableRecords, "quantity");
  syncConsoleMergeInput();
  const mergeSize = readConsoleMergeSize();
  syncConsoleSubmitLimitInput();
  const submitLimit = readConsoleSubmitLimit();
  const groups = groupRecordsByQuantity(records, mergeSize);
  const nearestDueDay = isAllView ? nearestGroupDueDay(groups) : null;
  if (!isAllView) {
    syncSelectedClaimGroups(groups);
  }
  const selectedGroups = isAllView ? [] : selectedClaimGroupsForSelectedWallet(groups);
  const transactionGroups = isAllView ? [] : transactionGroupsForSelectedGroups(selectedGroups, submitLimit);
  const selectedCount = sum(selectedGroups, "quantity");
  const termDays = readConsoleTermDays();
  const isClaimOnly = mode === "claim";
  updateConsoleToolbarChecks(groups, selectedGroups, isAllView, nearestDueDay);
  elements.consoleTermField.hidden = mode === "claim" || isAllView;
  elements.consoleTermLabel.textContent = "复投天数";
  elements.consoleGrid.classList.remove("mint-mode");
  elements.consoleMintField.hidden = true;
  elements.consoleMintRangeField.hidden = true;
  elements.consoleMergeBar.hidden = false;
  elements.consoleMergeField.hidden = false;
  elements.consoleSubmitLimitField.hidden = isAllView;
  elements.consoleExpiryField.hidden = isClaimOnly || isAllView;
  elements.sideBatchSizeLabel.textContent = `${number(submitLimit)} 个/笔`;
  elements.consoleMetricLabel.textContent = isAllView ? "已种编号" : (isClaimOnly ? "可收数量" : "可复投数量");
  elements.consoleGas.textContent = renderGasText(payload.gas);
  elements.consoleHint.hidden = false;
  elements.consoleClaimable.textContent = isAllView
    ? number(claimableCount)
    : isClaimOnly && selectedCount <= 0
    ? number(executableCount)
    : `${number(selectedCount)}/${number(executableCount)}`;
  elements.consoleSelectedGroups.textContent = `已选 ${number(selectedGroups.length)} 组 / 共 ${number(groups.length)} 组`;
  elements.consoleSelectedQuantity.textContent = `已选 ${number(selectedCount)} 个地址`;
  elements.consoleRange.hidden = true;
  elements.consoleRange.textContent = "";
  elements.consoleTxCount.textContent = isAllView ? "-" : (transactionGroups.length > 0 ? `${number(transactionGroups.length)} 笔` : "-");
  elements.consoleExpiryLabel.textContent = "预计新到期";
  const expiryDate = termDays > 0 ? addDaysIso(consoleToday(), termDays) : null;
  elements.consoleExpiry.textContent = expiryDate ? formatDate(expiryDate) : "-";
  elements.consoleExpiryWeekday.textContent = expiryDate ? formatWeekday(expiryDate) : "";
  elements.consoleExpiryDateInput.value = expiryDate ?? "";
  renderConsoleExpiryCalendar(expiryDate);
  elements.startClaimRemintButton.disabled = isAllView || selectedCount <= 0 || !wallet;
  elements.startClaimRemintButton.textContent = isAllView ? "查看全部" : (isClaimOnly ? "开始收菜" : "开始复投");
  elements.consoleHint.textContent = executableCount > 0
    ? (isAllView
      ? `查看全部按 ${number(mergeSize)} 个展示所有已种编号，只查看大致情况，不可选中操作。`
      : `下方按 ${number(mergeSize)} 个生成可选分组，右侧按单笔上限 ${number(submitLimit)} 个合并为钱包确认。`)
    : "等待链上成熟后再执行，页面会自动刷新。";
  elements.consoleBatchSelector.innerHTML = records.length > 0
    ? renderSelectableBatchSelector(groups, selectedGroups, mode, isAllView, nearestDueDay)
    : `<div class="empty">暂无${isAllView ? "已种编号" : `已成熟可${isClaimOnly ? "收" : "复投"}批次`}</div>`;
  elements.batchPreviewList.innerHTML = isAllView
    ? `<div class="empty">查看全部模式不生成交易预览</div>`
    : renderMergePreview(transactionGroups);
  if (isAllView && state.viewNearestDueDayOnly && nearestDueDay) {
    requestAnimationFrame(scrollToFirstNearestDueCard);
  }
}

function renderMintConsole(payload) {
  const wallet = selectedWalletRow();
  const maxMintTermDays = readConsoleMaxMintTermDays();
  if (state.consoleSubmitLimits.mint == null) {
    state.consoleSubmitLimits.mint = payload.data.metadata.plannedMintBatchSize ?? 50;
    restoreConsoleSubmitLimitForMode();
  }
  syncConsoleSubmitLimitInput();
  const submitLimit = readConsoleSubmitLimit();
  elements.consoleMintCountInput.removeAttribute("max");
  const planCount = readConsoleMintCount();
  const termDays = readConsoleTermDays();
  elements.consoleTermInput.max = String(maxMintTermDays);
  elements.consoleTermInput.value = String(termDays);
  elements.consoleExpiryDateInput.max = addDaysIso(consoleToday(), maxMintTermDays);
  const idStart = nextChainId(wallet ?? {});
  const idEnd = planCount > 0 ? idStart + planCount - 1 : null;
  const expiryDate = termDays > 0 ? addDaysIso(consoleToday(), termDays) : null;
  elements.consoleTermField.hidden = false;
  elements.consoleTermLabel.textContent = "种植天数";
  elements.consoleGrid.classList.add("mint-mode");
  elements.consoleMintField.hidden = false;
  elements.consoleMintRangeField.hidden = false;
  elements.consoleMergeBar.hidden = true;
  elements.consoleMergeField.hidden = true;
  elements.consoleSelectAllField.hidden = true;
  elements.consoleDueWeekField.hidden = true;
  elements.consoleSubmitLimitField.hidden = false;
  elements.consoleExpiryField.hidden = false;
  elements.sideBatchSizeLabel.textContent = `${number(submitLimit)} 个/笔`;
  elements.consoleMetricLabel.textContent = "已种数量";
  elements.consoleGas.textContent = renderGasText(payload.gas);
  elements.consoleClaimable.textContent = wallet?.chainMinted == null ? "-" : number(wallet.chainMinted);
  elements.consoleMintRange.textContent = planCount > 0 ? formatIdRange(idStart, idEnd) : "-";
  elements.consoleSelectedGroups.textContent = "已选 0 组 / 共 0 组";
  elements.consoleSelectedQuantity.textContent = "已选 0 个地址";
  elements.consoleRange.hidden = true;
  elements.consoleRange.textContent = "";
  elements.consoleTxCount.textContent = planCount > 0 ? `${number(Math.ceil(planCount / submitLimit))} 笔` : "-";
  elements.consoleExpiryLabel.textContent = "预计到期";
  elements.consoleExpiry.textContent = expiryDate ? formatDate(expiryDate) : "-";
  elements.consoleExpiryWeekday.textContent = expiryDate ? formatWeekday(expiryDate) : "";
  elements.consoleExpiryDateInput.value = expiryDate ?? "";
  renderConsoleExpiryCalendar(expiryDate);
  elements.startClaimRemintButton.disabled = !canMintWallet(wallet) || planCount <= 0 || termDays <= 0;
  elements.startClaimRemintButton.textContent = "开始种菜";
  elements.consoleHint.textContent = "";
  elements.consoleHint.hidden = true;
  elements.consoleBatchSelector.innerHTML = "";
  elements.batchPreviewList.innerHTML = planCount > 0
    ? mintPreviewRows(idStart, planCount, submitLimit)
    : `<div class="empty">请输入 Mint 数量</div>`;
}

function renderModeButtons() {
  document.querySelectorAll("[data-console-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.consoleMode === state.consoleMode);
  });
  if (state.consoleMode === "claimRemint") {
    elements.startClaimRemintButton.textContent = "开始复投";
  } else if (state.consoleMode === "claim") {
    elements.startClaimRemintButton.textContent = "开始收菜";
  } else if (state.consoleMode === "all") {
    elements.startClaimRemintButton.textContent = "查看全部";
  }
}

function selectedWalletRow() {
  return state.payload?.data?.wallets?.find((item) => item.sheet === state.selectedSheet) ?? null;
}

function claimableRecordsForSelectedWallet() {
  const data = state.payload?.data;
  if (!data || !state.selectedSheet) {
    return [];
  }
  const walletRecords = data.claimable
    .filter((record) => record.sheet === state.selectedSheet);
  const chainRows = walletRecords.filter((record) => record.source === "chain");
  return (chainRows.length > 0 ? chainRows : walletRecords).sort(recordTimeSort);
}

function allMintRecordsForSelectedWallet() {
  const data = state.payload?.data;
  if (!data || !state.selectedSheet) {
    return [];
  }
  return (data.allMint ?? [])
    .filter((record) => record.sheet === state.selectedSheet)
    .sort(recordIdSort);
}

function claimRecordRowsForSelectedWallet(mode) {
  return mode === "all" ? allMintRecordsForSelectedWallet() : claimableRecordsForSelectedWallet();
}

function readConsoleMergeSize() {
  return Math.max(1, Number.parseInt(elements.consoleMergeSizeInput.value, 10) || 1);
}

function readConsoleSubmitLimit() {
  return Math.max(1, Number.parseInt(elements.consoleSubmitLimitInput.value, 10) || 1);
}

function defaultConsoleSubmitLimit(mode = state.consoleMode) {
  return mode === "mint"
    ? (state.payload?.data?.metadata?.plannedMintBatchSize ?? 50)
    : 100;
}

function saveConsoleSubmitLimitForMode(mode = state.consoleMode) {
  state.consoleSubmitLimits[mode] = readConsoleSubmitLimit();
}

function restoreConsoleSubmitLimitForMode(mode = state.consoleMode) {
  const value = state.consoleSubmitLimits[mode] ?? defaultConsoleSubmitLimit(mode);
  elements.consoleSubmitLimitInput.value = String(Math.max(1, Number.parseInt(value, 10) || defaultConsoleSubmitLimit(mode)));
}

function syncConsoleMergeInput(options = {}) {
  const normalize = Boolean(options.normalize);
  if (normalize) {
    elements.consoleMergeSizeInput.value = String(readConsoleMergeSize());
  }
}

function syncConsoleSubmitLimitInput(options = {}) {
  const normalize = Boolean(options.normalize);
  if (normalize) {
    elements.consoleSubmitLimitInput.value = String(readConsoleSubmitLimit());
  }
}

function selectedClaimGroupsForSelectedWallet(groups = groupRecordsByQuantity(claimableRecordsForSelectedWallet(), readConsoleMergeSize())) {
  return groups.filter((group) => state.selectedClaimGroups.has(group.key) && groupIsExecutable(group));
}

function syncSelectedClaimGroups(groups) {
  const keys = new Set(groups.filter(groupIsExecutable).map((group) => group.key));
  for (const key of [...state.selectedClaimGroups]) {
    if (!keys.has(key)) {
      state.selectedClaimGroups.delete(key);
    }
  }
}

function setAllExecutableClaimGroups(selected) {
  const groups = groupRecordsByQuantity(claimRecordRowsForSelectedWallet(state.consoleMode), readConsoleMergeSize());
  for (const group of groups.filter(groupIsExecutable)) {
    setClaimGroupSelection(group.key, selected);
  }
}

function updateConsoleToolbarChecks(groups, selectedGroups, isAllView, nearestDueDay = null) {
  const executableGroups = groups.filter(groupIsExecutable);
  const selectedKeys = new Set(selectedGroups.map((group) => group.key));
  elements.consoleSelectAllField.hidden = isAllView;
  elements.consoleDueWeekField.hidden = !isAllView || !nearestDueDay;
  elements.consoleSelectAllCheckbox.checked = executableGroups.length > 0 && executableGroups.every((group) => selectedKeys.has(group.key));
  elements.consoleSelectAllCheckbox.indeterminate = !elements.consoleSelectAllCheckbox.checked && executableGroups.some((group) => selectedKeys.has(group.key));
  elements.consoleSelectAllCheckbox.disabled = executableGroups.length === 0;
  elements.consoleDueWeekCheckbox.disabled = !nearestDueDay;
  elements.consoleDueWeekCheckbox.checked = state.viewNearestDueDayOnly && Boolean(nearestDueDay);
}

function setClaimGroupSelection(key, selected) {
  if (selected) {
    state.selectedClaimGroups.add(key);
  } else {
    state.selectedClaimGroups.delete(key);
  }
}

function renderSelectableBatchSelector(groups, selectedGroups, mode = "claimRemint", isAllView = false, nearestDueDay = null) {
  const selectedKeys = new Set(selectedGroups.map((group) => group.key));
  return `
    <div class="console-batch-card-grid">
      ${groups.map((group) => selectableBatchCard(group, selectedKeys.has(group.key), mode, isAllView, nearestDueDay)).join("")}
    </div>
  `;
}

function renderMergePreview(groups) {
  return groups.length > 0
    ? groups.map((group, index) => mergePreviewRow(group, index)).join("")
    : `<div class="empty">勾选底部卡片后显示交易分组</div>`;
}

function transactionGroupsForSelectedGroups(selectedGroups, submitLimit) {
  const groups = [];
  let current = emptyClaimGroup();
  for (const part of selectedGroups.flatMap((group) => group.parts)) {
    let nextId = part.idStart;
    while (nextId <= part.idEnd) {
      if (current.quantity === submitLimit) {
        groups.push(finalizeClaimGroup(current));
        current = emptyClaimGroup();
      }
      const remainingSpace = submitLimit - current.quantity;
      const idEnd = Math.min(part.idEnd, nextId + remainingSpace - 1);
      const quantity = idEnd - nextId + 1;
      current.parts.push({ record: part.record, idStart: nextId, idEnd, quantity });
      current.quantity += quantity;
      nextId = idEnd + 1;
    }
  }
  if (current.quantity > 0) {
    groups.push(finalizeClaimGroup(current));
  }
  return groups;
}

function selectableBatchCard(group, checked, mode = "claimRemint", isAllView = false, nearestDueDay = null) {
  const chainRoundText = group.chainRoundText;
  const roundClass = group.hasRoundMismatch ? " round-mismatch" : "";
  const executable = groupIsExecutable(group);
  const disabledClass = executable ? "" : " not-executable";
  const nearestDue = Boolean(nearestDueDay && groupDueDay(group) === nearestDueDay);
  const nearestDueClass = isAllView && state.viewNearestDueDayOnly && nearestDue ? " nearest-due-highlight" : "";
  const nearestDueData = isAllView && nearestDue ? ` data-nearest-due="true"` : "";
  const statusText = isAllView ? groupStatusLabel(group, mode) : chainRoundText;
  const maturityText = isAllView ? groupMaturityTimeText(group) : group.timeText;
  if (isAllView) {
    return `
      <article class="claim-address-card view-only${roundClass}${disabledClass}${nearestDueClass}"${nearestDueData}>
        <div class="claim-address-card-top">
          <strong class="claim-range-label">${escapeHtml(group.label)}</strong>
          <span>${number(group.quantity)} 个</span>
        </div>
        <div class="claim-address-card-chain${group.hasRoundMismatch ? " round-mismatch" : ""}">${escapeHtml(statusText)}</div>
        <div class="claim-address-card-meta">
          <span>${escapeHtml(maturityText)}</span>
        </div>
      </article>
    `;
  }
  return `
    <label class="claim-address-card selectable${roundClass}${disabledClass}">
      <input type="checkbox" data-console-group-key="${escapeHtml(group.key)}"${checked && executable ? " checked" : ""}${executable ? "" : " disabled"} />
      <div class="claim-address-card-top">
        <strong class="claim-range-label">${escapeHtml(group.label)}</strong>
        <span>${number(group.quantity)} 个</span>
      </div>
      <div class="claim-address-card-chain${group.hasRoundMismatch ? " round-mismatch" : ""}">${escapeHtml(statusText)}</div>
      <div class="claim-address-card-meta">
        <span>${group.timeText}</span>
      </div>
    </label>
  `;
}

function nearestGroupDueDay(groups) {
  return groups
    .map(groupDueDay)
    .filter(Boolean)
    .sort()[0] ?? null;
}

function groupDueDay(group) {
  const days = group.parts
    .map((part) => part.record.unlockTime ?? part.record.expiryDate)
    .filter(Boolean)
    .map((time) => localDateKey(new Date(time)))
    .sort();
  return days[0] ?? null;
}

function scrollToFirstNearestDueCard() {
  const card = elements.consoleBatchSelector.querySelector("[data-nearest-due='true']");
  card?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function scrollToTop() {
  if (state.viewNearestDueDayOnly) {
    state.viewNearestDueDayOnly = false;
    elements.consoleDueWeekCheckbox.checked = false;
    renderConsole(state.payload);
  }
  requestAnimationFrame(() => {
    const walletSection = document.querySelector(".wallet-spread-section");
    if (walletSection) {
      window.scrollTo({
        top: Math.max(0, window.scrollY + walletSection.getBoundingClientRect().bottom - 10),
        behavior: "smooth",
      });
      return;
    }
    const target = document.querySelector(".console-layout") ?? elements.consoleMergeBar ?? elements.consoleBatchSelector;
    if (document.scrollingElement) {
      document.scrollingElement.scrollTop = target?.offsetTop ?? elements.consoleBatchSelector?.offsetTop ?? 0;
    }
  });
}

function positionScrollTopButton() {
  const main = document.querySelector(".console-main");
  if (!main || window.innerWidth <= 760) {
    hideScrollTopButton();
    return;
  }
  const cards = [...elements.consoleBatchSelector.querySelectorAll(".claim-address-card")];
  const cardRows = batchCardRowCount(cards);
  const columns = batchCardColumnCount(cards);
  const tenthRowIndex = Math.min(cards.length - 1, columns * 9);
  const tenthRowCard = cards[tenthRowIndex];
  const tenthRowOffset = tenthRowCard
    ? window.scrollY + tenthRowCard.getBoundingClientRect().top - window.innerHeight + tenthRowCard.getBoundingClientRect().height + 24
    : Number.POSITIVE_INFINITY;
  if (cardRows <= 10 || window.scrollY < tenthRowOffset) {
    hideScrollTopButton();
    return;
  }
  elements.scrollTopButton.hidden = false;
  const rect = main.getBoundingClientRect();
  const buttonWidth = elements.scrollTopButton.offsetWidth || 118;
  elements.scrollTopButton.style.left = `${Math.round(rect.right - buttonWidth)}px`;
  elements.scrollTopButton.style.right = "auto";
}

function hideScrollTopButton() {
  elements.scrollTopButton.hidden = true;
  elements.scrollTopButton.style.left = "";
  elements.scrollTopButton.style.right = "";
}

function batchCardRowCount(cards) {
  return new Set(cards.map((card) => Math.round(card.offsetTop))).size;
}

function batchCardColumnCount(cards) {
  if (cards.length === 0) {
    return 1;
  }
  const firstRowTop = Math.round(cards[0].offsetTop);
  return Math.max(1, cards.filter((card) => Math.round(card.offsetTop) === firstRowTop).length);
}

function recordIsExecutable(record) {
  return record.status === "claimable";
}

function groupIsExecutable(group) {
  return group.parts.every((part) => recordIsExecutable(part.record));
}

function groupStatusLabel(group, mode = "claimRemint") {
  if (groupIsExecutable(group)) {
    return mode === "claim" ? "已成熟，可收" : "已成熟，可复投";
  }
  return "未成熟";
}

function groupMaturityTimeText(group) {
  const unlocks = group.parts
    .map((part) => part.record.unlockTime ?? part.record.expiryDate)
    .filter(Boolean)
    .sort();
  return unlocks.length > 0 ? formatDateTime(unlocks[0]) : "-";
}

function remintRoundLabel(round) {
  return round > 0 ? `${"F".repeat(round)} / 第 ${number(round)} 轮` : "首次 Mint";
}

function groupRecordsByQuantity(records, maxSize) {
  const groups = [];
  let current = emptyClaimGroup();
  for (const record of records) {
    const range = parseIdRange(record.baseLabel ?? record.label);
    if (!range) {
      continue;
    }
    let nextId = range.start;
    while (nextId <= range.end) {
      if (current.quantity === maxSize) {
        groups.push(finalizeClaimGroup(current));
        current = emptyClaimGroup();
      }
      const remainingSpace = maxSize - current.quantity;
      const idEnd = Math.min(range.end, nextId + remainingSpace - 1);
      const quantity = idEnd - nextId + 1;
      current.parts.push({ record, idStart: nextId, idEnd, quantity });
      current.quantity += quantity;
      nextId = idEnd + 1;
    }
  }
  if (current.quantity > 0) {
    groups.push(finalizeClaimGroup(current));
  }
  return groups;
}

function emptyClaimGroup() {
  return { parts: [], quantity: 0 };
}

function finalizeClaimGroup(group) {
  const idStart = group.parts[0].idStart;
  const idEnd = group.parts.at(-1).idEnd;
  const label = isContinuousGroup(group.parts)
    ? formatIdRange(idStart, idEnd)
    : group.parts.map((part) => formatIdRange(part.idStart, part.idEnd)).join(" + ");
  const key = group.parts.map((part) => `${part.record.rowNumber}:${part.idStart}-${part.idEnd}`).join("|");
  const firstUnlock = group.parts.map((part) => part.record.unlockTime).find(Boolean);
  return {
    ...group,
    key,
    idStart,
    idEnd,
    label,
    timeText: firstUnlock ? formatDateTime(firstUnlock) : "-",
    roundText: groupRoundText(group.parts),
    chainRoundText: chainRoundDisplay(group.parts),
    hasRoundMismatch: group.parts.some((part) => part.record.remintRoundMismatch),
  };
}

function isContinuousGroup(parts) {
  return parts.every((part, index) => index === 0 || parts[index - 1].idEnd + 1 === part.idStart);
}

function groupRoundText(parts) {
  const rounds = new Set(parts.map((part) => part.record.remintRound ?? 0));
  if (rounds.size === 1) {
    const round = [...rounds][0];
    return round > 0 ? `第 ${number(round)} 轮复投` : "首次 Mint";
  }
  return "混合轮次";
}

function chainRoundDisplay(parts) {
  const rounds = new Set(parts.map((part) => part.record.chainRemintRound).filter((round) => round != null));
  if (rounds.size === 0) {
    if (parts.every((part) => part.record.source === "chain")) {
      return "链上状态: 已校验";
    }
    return "链上状态: 发起前校验";
  }
  if (rounds.size === 1) {
    return `链上轮次: ${remintRoundLabel([...rounds][0])}`;
  }
  return "链上轮次: 混合";
}

function mergePreviewRow(group, index) {
  return `
    <div class="batch-preview-row merge-preview-row">
      <span>交易 ${number(index + 1)}</span>
      <strong>${escapeHtml(group.label)}</strong>
      <em>${number(group.quantity)} 个</em>
    </div>
  `;
}

function selectedBatchPayload(part) {
  return {
    rowNumber: part.record.rowNumber,
    idStart: part.idStart,
    idEnd: part.idEnd,
  };
}

function renderTransactionRanges(tx) {
  return Array.isArray(tx.idRanges) && tx.idRanges.length > 0
    ? tx.idRanges.join(" + ")
    : `${number(tx.idStart)}-${number(tx.idEnd)}`;
}

function readConsoleTermDays() {
  const termDays = clampMintTermDays(elements.consoleTermInput.value);
  elements.consoleTermInput.value = String(termDays);
  return termDays;
}

function setConsoleTermDays(termDays) {
  elements.consoleTermInput.value = String(clampMintTermDays(termDays));
  renderConsole(state.payload);
}

function readConsoleMintCount() {
  return Math.max(1, Number.parseInt(elements.consoleMintCountInput.value, 10) || 1);
}

function readConsoleMaxMintTermDays() {
  return state.payload?.data?.metadata?.maxMintTermDays ?? 488;
}

function clampMintTermDays(termDays) {
  return Math.min(readConsoleMaxMintTermDays(), Math.max(1, Number.parseInt(termDays, 10) || 1));
}

function openConsoleExpiryDatePicker() {
  state.consoleExpiryCalendarOpen = true;
  state.consoleExpiryCalendarMonth = (elements.consoleExpiryDateInput.value || addDaysIso(consoleToday(), readConsoleTermDays())).slice(0, 7);
  renderConsoleExpiryCalendar(elements.consoleExpiryDateInput.value);
}

function closeConsoleExpiryCalendar() {
  state.consoleExpiryCalendarOpen = false;
  elements.consoleExpiryCalendar.hidden = true;
}

function renderConsoleExpiryCalendar(selectedDate) {
  if (!state.consoleExpiryCalendarOpen) {
    elements.consoleExpiryCalendar.hidden = true;
    return;
  }
  const monthKey = state.consoleExpiryCalendarMonth ?? (selectedDate || consoleToday()).slice(0, 7);
  const [year, month] = monthKey.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const startOffset = (firstDay.getUTCDay() + 6) % 7;
  const today = consoleToday();
  const maxTermDays = readConsoleMaxMintTermDays();
  const dayCells = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(Date.UTC(year, month - 1, 1 - startOffset + index));
    const isoDate = date.toISOString().slice(0, 10);
    const termDays = daysBetweenIso(today, isoDate);
    const isOutside = date.getUTCMonth() !== month - 1;
    const isSelected = isoDate === selectedDate;
    const disabled = termDays < 1 || termDays > maxTermDays;
    dayCells.push(`
      <button class="console-calendar-day${isOutside ? " outside" : ""}${isSelected ? " selected" : ""}" type="button" data-calendar-date="${isoDate}"${disabled ? " disabled" : ""}>
        ${date.getUTCDate()}
      </button>
    `);
  }
  elements.consoleExpiryCalendar.hidden = false;
  elements.consoleExpiryCalendar.innerHTML = `
    <div class="console-calendar-header">
      <button type="button" data-calendar-action="prevYear" aria-label="上一年">←</button>
      <button type="button" data-calendar-action="prev" aria-label="上个月">‹</button>
      <strong>${year}年${String(month).padStart(2, "0")}月</strong>
      <button type="button" data-calendar-action="next" aria-label="下个月">›</button>
      <button type="button" data-calendar-action="nextYear" aria-label="下一年">→</button>
    </div>
    <div class="console-calendar-weekdays" aria-hidden="true">
      <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
    </div>
    <div class="console-calendar-days">
      ${dayCells.join("")}
    </div>
    <div class="console-calendar-footer">
      <button class="console-calendar-footer-action" type="button" data-calendar-action="max">最长期限</button>
    </div>
  `;
}

function shiftMonthKey(monthKey, delta) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function canMintWallet(wallet) {
  return Boolean(wallet && wallet.chainMinted != null);
}

function mintPreviewRows(idStart, count, batchSize) {
  const rows = [];
  for (let offset = 0; offset < count; offset += batchSize) {
    const start = idStart + offset;
    const end = Math.min(idStart + count - 1, start + batchSize - 1);
    rows.push(`
      <div class="batch-preview-row">
        <span>第 ${number(rows.length + 1)} 笔</span>
        <strong>${number(start)}-${number(end)}</strong>
        <em>${number(end - start + 1)} 个</em>
      </div>
    `);
  }
  return rows.join("");
}

function renderGasText(gas) {
  if (!gas.snapshot.gasPriceGwei) {
    return "未知";
  }
  const value = `${gas.snapshot.gasPriceGwei.toFixed(3)} gwei`;
  if (!gas.maxFeeGwei) {
    return value;
  }
  return `${value} / 阈值 ${gas.maxFeeGwei}`;
}

function renderChainMinted(row) {
  if (row.chainStatus === "error" && row.chainMinted == null) {
    return `<span class="chain-error">失败</span>`;
  }
  if (row.chainStatus !== "ok" && row.chainMinted == null) {
    return "-";
  }
  return number(row.chainMinted);
}

function renderChainDelta(row) {
  if (row.chainStatus === "error") {
    return `<span class="chain-error">${escapeHtml(row.chainError ?? "查询失败")}</span>`;
  }
  if (row.chainStatus !== "ok" || row.chainDelta == null) {
    return "-";
  }
  const className = row.chainDelta === 0 ? "delta-ok" : "delta-bad";
  const prefix = row.chainDelta > 0 ? "+" : "";
  return `<span class="${className}">${prefix}${number(row.chainDelta)}</span>`;
}

async function sendConsoleMintTransactions() {
  const wallet = selectedWalletRow();
  if (!wallet) {
    alert("请先选择钱包。");
    return;
  }
  if (!canMintWallet(wallet)) {
    alert("链上编号未准备好，不能 mint。请先刷新链上确认。");
    return;
  }
  const plannedCount = readConsoleMintCount();
  const termDays = readConsoleTermDays();
  const submitLimit = readConsoleSubmitLimit();
  if (!Number.isSafeInteger(plannedCount) || plannedCount <= 0) {
    alert("请输入本次 Mint 数量。");
    return;
  }
  if (!Number.isSafeInteger(termDays) || termDays <= 0) {
    alert("请输入种植天数。");
    return;
  }
  let preview = null;
  let sentTransactions = [];
  try {
    elements.startClaimRemintButton.disabled = true;
    elements.startClaimRemintButton.textContent = "生成只种交易...";
    preview = await requestMintPreview(wallet.sheet, { wallet: wallet.wallet, plannedCount, termDays, submitLimit });
    sentTransactions = await sendPreviewTransactions(preview, {
      pendingMessage: (tx) => `等待 Mint：${number(tx.idStart)}-${number(tx.idEnd)}`,
      sentMessage: (tx, txHash) => `已发起 Mint：${number(tx.idStart)}-${number(tx.idEnd)} · ${shortHash(txHash)}`,
    });
    appendExecutionLog(`Mint 完成：已发起 ${number(sentTransactions.length)} 笔`);
    await loadDashboard();
  } catch (error) {
    sentTransactions = error.sentTransactions ?? sentTransactions;
    if (preview && sentTransactions.length > 0) {
      appendExecutionLog(`Mint 停止：已发起 ${number(sentTransactions.length)} 笔，${error.message}`);
      await loadDashboard();
    } else {
      appendExecutionLog(`Mint 失败：${error.message}`);
      alert(`Mint 失败：${error.message}`);
    }
  } finally {
    elements.startClaimRemintButton.disabled = false;
    elements.startClaimRemintButton.textContent = "开始种菜";
    renderConsole(state.payload);
  }
}

async function sendClaimRemintTransactions() {
  const sheet = state.selectedSheet;
  const wallet = selectedWalletRow();
  if (!sheet || !wallet) {
    alert("请先选择钱包。");
    return;
  }
  const termDays = readConsoleTermDays();
  const submitLimit = readConsoleSubmitLimit();
  const selectedGroups = selectedClaimGroupsForSelectedWallet();
  let preview = null;
  let sentTransactions = [];
  if (selectedGroups.length === 0) {
    alert("请先勾选要复投的分组卡片。");
    return;
  }
  try {
    elements.startClaimRemintButton.disabled = true;
    elements.startClaimRemintButton.textContent = "重新校验链上...";
    preview = await requestClaimRemintPreview(sheet, {
      wallet: wallet.wallet,
      termDays,
      submitLimit,
      selectedBatches: selectedGroups.flatMap((group) => group.parts.map(selectedBatchPayload)),
    });
    sentTransactions = await sendPreviewTransactions(preview, {
      pendingMessage: (tx) => `等待确认：${renderTransactionRanges(tx)}`,
      sentMessage: (tx, txHash) => `已发起：${renderTransactionRanges(tx)} · ${shortHash(txHash)}`,
    });
    appendExecutionLog(`完成：已发起 ${number(sentTransactions.length)} 笔`);
    await loadDashboard();
  } catch (error) {
    sentTransactions = error.sentTransactions ?? sentTransactions;
    if (preview && sentTransactions.length > 0) {
      appendExecutionLog(`停止：已发起 ${number(sentTransactions.length)} 笔，${error.message}`);
      await loadDashboard();
    } else {
      appendExecutionLog(`失败：${error.message}`);
      alert(`发起失败：${error.message}`);
    }
  } finally {
    elements.startClaimRemintButton.disabled = false;
    elements.startClaimRemintButton.textContent = "开始复投";
    renderConsole(state.payload);
  }
}

async function sendClaimTransactions() {
  const sheet = state.selectedSheet;
  const wallet = selectedWalletRow();
  if (!sheet || !wallet) {
    alert("请先选择钱包。");
    return;
  }
  const submitLimit = readConsoleSubmitLimit();
  const selectedGroups = selectedClaimGroupsForSelectedWallet();
  let preview = null;
  let sentTransactions = [];
  if (selectedGroups.length === 0) {
    alert("请先勾选要只收的分组卡片。");
    return;
  }
  try {
    elements.startClaimRemintButton.disabled = true;
    elements.startClaimRemintButton.textContent = "重新校验链上...";
    preview = await requestClaimPreview(sheet, {
      wallet: wallet.wallet,
      submitLimit,
      selectedBatches: selectedGroups.flatMap((group) => group.parts.map(selectedBatchPayload)),
    });
    sentTransactions = await sendPreviewTransactions(preview, {
      pendingMessage: (tx) => `等待只收：${renderTransactionRanges(tx)}`,
      sentMessage: (tx, txHash) => `已发起只收：${renderTransactionRanges(tx)} · ${shortHash(txHash)}`,
    });
    appendExecutionLog(`只收完成：已发起 ${number(sentTransactions.length)} 笔`);
    await loadDashboard();
  } catch (error) {
    sentTransactions = error.sentTransactions ?? sentTransactions;
    if (preview && sentTransactions.length > 0) {
      appendExecutionLog(`只收停止：已发起 ${number(sentTransactions.length)} 笔，${error.message}`);
      await loadDashboard();
    } else {
      appendExecutionLog(`只收失败：${error.message}`);
      alert(`只收失败：${error.message}`);
    }
  } finally {
    elements.startClaimRemintButton.disabled = false;
    elements.startClaimRemintButton.textContent = "开始收菜";
    renderConsole(state.payload);
  }
}

async function sendPreviewTransactions(preview, options) {
  return withQueueRunnerLock(async () => {
    assertPreviewPlan(preview);
    logTransactionPlan(preview, "preview");
    const from = state.connectedWallet ?? await ensureConnectedWallet();
    const ethereum = activeWalletProvider();
    const sentTransactions = [];
    if (!from) {
      return sentTransactions;
    }
    if (from.toLowerCase() !== preview.wallet.toLowerCase()) {
      alert(`请在钱包里切换到 ${preview.wallet}，当前账户不是这个钱包。`);
      return sentTransactions;
    }
    if (!ethereum?.request) {
      alert("请先选择并连接钱包。");
      return sentTransactions;
    }
    if (shouldQueueWalletRequests() && preview.transactions.length > 1) {
      return sendQueuedPreviewTransactions(preview, options, ethereum, from);
    }
    for (const tx of preview.transactions) {
      elements.startClaimRemintButton.textContent = `Signing ${tx.index}/${preview.transactionCount}`;
      appendExecutionLog(options.pendingMessage(tx));
      appendExecutionLog("Waiting wallet confirmation...");
      const txHash = await sendWalletTransaction(ethereum, from, tx);
      const sentTransaction = {
        txHash,
        count: tx.count,
        idStart: tx.idStart,
        idEnd: tx.idEnd,
        idRanges: tx.idRanges ?? [],
      };
      sentTransactions.push(sentTransaction);
      appendExecutionLog(options.sentMessage(tx, txHash));
      elements.startClaimRemintButton.textContent = `Submitted ${tx.index}/${preview.transactionCount}`;
      const receipt = await waitForWalletTransactionReceipt(ethereum, txHash, {
        onPending: () => {
          recordTransactionStatus(tx, "Pending", {
            txHash,
            notes: transactionStatusMessages.Pending,
          });
          elements.startClaimRemintButton.textContent = `Pending ${tx.index}/${preview.transactionCount}`;
        },
        onNotPropagated: () => {
          recordTransactionStatus(tx, "Not Propagated", {
            txHash,
            notes: transactionStatusMessages["Not Propagated"],
          });
        },
      });
      assertEffectfulReceipt(preview, tx, receipt);
      appendExecutionLog(`已上链：${renderTransactionRanges(tx)} · ${shortHash(txHash)}`);
    }
    logTransactionPlan(preview, "complete");
    return sentTransactions;
  });
}

function shouldQueueWalletRequests() {
  return ["mint", "claimRemint"].includes(state.consoleMode);
}

async function withQueueRunnerLock(callback) {
  if (state.queueRunnerActive) {
    throw new Error(duplicateSubmissionMessage);
  }
  state.queueRunnerActive = true;
  try {
    return await callback();
  } finally {
    state.queueRunnerActive = false;
  }
}

function assertPreviewPlan(preview) {
  const seenOperationIds = new Set();
  for (const tx of preview.transactions ?? []) {
    if (!tx.operationId) {
      throw new Error("Transaction plan is missing operationId.");
    }
    if (seenOperationIds.has(tx.operationId)) {
      throw new Error(duplicateSubmissionMessage);
    }
    seenOperationIds.add(tx.operationId);
    assertOperationCanSubmit(tx);
  }
}

function logTransactionPlan(preview, phase) {
  console.log("[xen tx plan]", {
    phase,
    kind: preview.kind,
    total: preview.transactionCount,
    transactions: (preview.transactions ?? []).map((tx) => ({
      operationId: tx.operationId,
      range: renderTransactionRanges(tx),
      remintDays: tx.termDays ?? null,
      status: transactionRecordForOperation(tx.operationId)?.status ?? "Ready",
    })),
  });
}

function assertOperationCanSubmit(tx) {
  const existing = transactionRecordForOperation(tx.operationId);
  if (isTransactionRecordBlocking(existing)) {
    throw new Error(duplicateSubmissionMessage);
  }
  if ((operationSendCounts.get(tx.operationId) ?? 0) > 0) {
    throw new Error(duplicateSubmissionMessage);
  }
}

function isTransactionRecordBlocking(existing) {
  if (!existing || !transactionBlockingStatuses.has(existing.status)) {
    return false;
  }
  if (existing.status === "Signing" && !existing.txHash) {
    return false;
  }
  return true;
}

function nextOperationCallCount(tx) {
  const count = (operationSendCounts.get(tx.operationId) ?? 0) + 1;
  operationSendCounts.set(tx.operationId, count);
  return count;
}

function transactionRecordForOperation(operationId) {
  if (!operationId) {
    return null;
  }
  return loadTransactionRecords()[operationId] ?? null;
}

function recordTransactionStatus(tx, status, patch = {}) {
  if (!tx.operationId) {
    return;
  }
  const records = loadTransactionRecords();
  const previous = records[tx.operationId] ?? {};
  records[tx.operationId] = {
    ...previous,
    ...patch,
    operationId: tx.operationId,
    status,
    functionName: tx.functionName ?? previous.functionName ?? null,
    contractAddress: tx.contractAddress ?? tx.to,
    chainId: tx.chainId ?? previous.chainId ?? null,
    idStart: tx.idStart,
    idEnd: tx.idEnd,
    idRanges: tx.idRanges ?? previous.idRanges ?? [],
    count: tx.count,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(transactionRecordStorageKey, JSON.stringify(records));
}

function loadTransactionRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(transactionRecordStorageKey) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function sendQueuedPreviewTransactions(preview, options, ethereum, from) {
  const queueLimit = Math.min(walletQueueConcurrency, preview.transactions.length);
  appendExecutionLog(`等待钱包队列：共 ${number(preview.transactionCount)} 笔，每次最多 ${number(queueLimit)} 笔`);
  const sentTransactions = [];
  let nextIndex = 0;
  let firstError = null;
  const queuedProgress = {
    signedCount: 0,
    pendingOperationIds: new Set(),
    completedCount: 0,
    totalCount: preview.transactionCount,
  };
  updateQueuedWalletProgress(queuedProgress);

  async function runQueuedWalletRequest() {
    while (!firstError && nextIndex < preview.transactions.length) {
      const tx = preview.transactions[nextIndex];
      nextIndex += 1;
      updateQueuedWalletProgress(queuedProgress);
      appendExecutionLog(`唤起钱包 ${number(tx.index)}/${number(preview.transactionCount)}：${renderTransactionRanges(tx)}`);
      try {
        appendExecutionLog("Waiting wallet confirmation...");
        const txHash = await sendWalletTransaction(ethereum, from, tx);
        queuedProgress.signedCount += 1;
        updateQueuedWalletProgress(queuedProgress);
        appendExecutionLog(options.sentMessage(tx, txHash));
        sentTransactions.push({
          txHash,
          count: tx.count,
          idStart: tx.idStart,
          idEnd: tx.idEnd,
          idRanges: tx.idRanges ?? [],
        });
        const receipt = await waitForWalletTransactionReceipt(ethereum, txHash, {
          onPending: () => {
            recordTransactionStatus(tx, "Pending", {
              txHash,
              notes: transactionStatusMessages.Pending,
            });
            queuedProgress.pendingOperationIds.add(tx.operationId);
            updateQueuedWalletProgress(queuedProgress);
          },
          onNotPropagated: () => {
            recordTransactionStatus(tx, "Not Propagated", {
              txHash,
              notes: transactionStatusMessages["Not Propagated"],
            });
          },
        });
        assertEffectfulReceipt(preview, tx, receipt);
        queuedProgress.completedCount += 1;
        updateQueuedWalletProgress(queuedProgress);
        appendExecutionLog(`已上链：${renderTransactionRanges(tx)} · ${shortHash(txHash)}`);
      } catch (error) {
        if (!firstError) {
          firstError = error;
          appendExecutionLog(`队列中断 ${number(tx.index)}/${number(preview.transactionCount)}：${walletErrorMessage(error)}`);
        }
      }
    }
  }

  await Promise.all(Array.from({ length: queueLimit }, runQueuedWalletRequest));
  sentTransactions.sort((a, b) => (a.idStart ?? 0) - (b.idStart ?? 0));
  if (firstError) {
    const message = walletErrorMessage(firstError);
    throw Object.assign(new Error(`连续唤起中断：${message}`), { sentTransactions });
  }
  return sentTransactions;
}

function updateQueuedWalletProgress(progress) {
  elements.startClaimRemintButton.textContent = `签名 ${number(progress.signedCount)}/${number(progress.totalCount)}`;
}

async function sendWalletTransaction(ethereum, from, tx) {
  assertOperationCanSubmit(tx);
  const callCount = nextOperationCallCount(tx);
  if (callCount > 1) {
    throw new Error(duplicateSubmissionMessage);
  }
  recordTransactionStatus(tx, "Signing", {
    from,
    callCount,
    notes: "Waiting wallet confirmation...",
  });
  console.log("[xen tx submit]", {
    operationId: tx.operationId,
    range: renderTransactionRanges(tx),
    remintDays: tx.termDays ?? null,
    callCount,
    timestamp: new Date().toISOString(),
  });
  try {
    const txHash = await ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from,
          to: tx.to,
          value: tx.value,
          data: tx.data,
        },
      ],
    });
    recordTransactionStatus(tx, "Submitted", {
      from,
      txHash,
      callCount,
      notes: "Transaction submitted. Waiting for propagation.",
    });
    return txHash;
  } catch (error) {
    operationSendCounts.delete(tx.operationId);
    if (isWalletRejection(error)) {
      recordTransactionStatus(tx, "Cancelled", {
        from,
        callCount: 0,
        notes: transactionStatusMessages.Cancelled,
      });
      throw new Error(transactionStatusMessages.Cancelled);
    }
    recordTransactionStatus(tx, "Ready", {
      from,
      txHash: null,
      callCount: 0,
      notes: walletErrorMessage(error),
    });
    throw error;
  }
}

async function waitForWalletTransactionReceipt(ethereum, txHash, options = {}) {
  let seenOnChain = false;
  for (let poll = 0; poll < walletReceiptMaxPolls; poll += 1) {
    const receipt = await ethereum.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    });
    if (receipt) {
      return receipt;
    }
    const transaction = await ethereum.request({
      method: "eth_getTransactionByHash",
      params: [txHash],
    }).catch(() => null);
    if (transaction) {
      seenOnChain = true;
      options.onPending?.(poll);
    } else if (!seenOnChain && poll + 1 >= walletReceiptNotPropagatedPolls) {
      options.onNotPropagated?.(poll);
      throw Object.assign(new Error(transactionStatusMessages["Not Propagated"]), {
        transactionStatus: "Not Propagated",
      });
    }
    await sleep(walletReceiptPollMs);
  }
  const status = seenOnChain ? "Pending" : "Not Propagated";
  throw Object.assign(new Error(transactionStatusMessages[status]), {
    transactionStatus: status,
  });
}

function assertEffectfulReceipt(preview, tx, receipt) {
  const status = classifyTransactionReceipt(preview, tx, receipt);
  const xenLogCount = countXenLogs(receipt);
  recordTransactionStatus(tx, status, {
    txHash: receipt?.transactionHash,
    gasFeeEth: receiptGasFeeEth(receipt),
    actualXenLogCount: xenLogCount,
    expectedXenLogCount: tx.expectedXenLogCount ?? tx.count,
    notes: transactionStatusMessages[status] ?? "Manual check required.",
  });
  if (status !== "Confirmed Success") {
    throw Object.assign(new Error(transactionStatusMessages[status] ?? "Manual check required."), {
      transactionStatus: status,
    });
  }
}

function shouldRequireXenLogs(preview) {
  return preview.kind === "claim" || preview.kind === "claim_remint";
}

function classifyTransactionReceipt(preview, tx, receipt) {
  if (!receiptStatusSucceeded(receipt?.status)) {
    return "Failed";
  }
  if (!shouldRequireXenLogs(preview)) {
    return "Confirmed Success";
  }
  const expectedLogCount = tx.expectedXenLogCount ?? tx.count;
  const xenLogCount = countXenLogs(receipt);
  if (!Number.isSafeInteger(expectedLogCount) || expectedLogCount <= 0) {
    return xenLogCount > 0 ? "Confirmed Success" : "Need Check";
  }
  if (xenLogCount < expectedLogCount) {
    return "Partial Error";
  }
  return "Confirmed Success";
}

function receiptStatusSucceeded(status) {
  if (status == null) {
    return true;
  }
  if (typeof status === "number") {
    return status === 1;
  }
  return String(status).toLowerCase() === "0x1" || String(status) === "1";
}

function countXenLogs(receipt) {
  return Array.isArray(receipt?.logs) ? receipt.logs.filter((log) => (
    String(log?.address ?? "").toLowerCase() === xenContractAddress
  )).length : 0;
}

function receiptGasFeeEth(receipt) {
  const gasUsed = hexQuantityToBigInt(receipt?.gasUsed);
  const gasPrice = hexQuantityToBigInt(receipt?.effectiveGasPrice);
  if (gasUsed == null || gasPrice == null) {
    return null;
  }
  return formatEth(gasUsed * gasPrice);
}

function hexQuantityToBigInt(value) {
  if (value == null) {
    return null;
  }
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function formatEth(value) {
  const whole = value / 1_000_000_000_000_000_000n;
  const fraction = value % 1_000_000_000_000_000_000n;
  const trimmedFraction = fraction.toString().padStart(18, "0").replace(/0+$/, "");
  return trimmedFraction ? `${whole}.${trimmedFraction}` : String(whole);
}

function isWalletRejection(error) {
  const code = error?.code ?? error?.data?.code;
  const message = String(error?.message ?? "").toLowerCase();
  return code === 4001 || code === "ACTION_REJECTED" || message.includes("user rejected") || message.includes("user denied");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestMintPreview(sheet, options = {}) {
  const response = await fetch("/api/actions/mint-preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sheet, ...options }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function requestClaimRemintPreview(sheet, options = {}) {
  const response = await fetch("/api/actions/claim-remint-preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sheet, ...options }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

async function requestClaimPreview(sheet, options = {}) {
  const response = await fetch("/api/actions/claim-preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sheet, ...options }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

function appendExecutionLog(message) {
  const item = document.createElement("div");
  const time = new Date().toLocaleTimeString();
  item.innerHTML = `${escapeHtml(time)} · ${highlightExecutionMessage(message)}`;
  elements.executionLog.prepend(item);
}

function highlightExecutionMessage(message) {
  return escapeHtml(message).replace(
    /^(等待确认|完成|已发起|已上链|停止|失败|等待 Mint|已发起 Mint|Mint 完成|Mint 停止|Mint 失败|等待只收|已发起只收|只收完成|只收停止|只收失败)(：)/,
    "<strong>$1</strong>$2",
  );
}

function loadMonitoredWallets() {
  try {
    localStorage.removeItem(legacyMonitoredWalletStorageKey);
    const raw = localStorage.getItem(monitoredWalletStorageKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMonitoredWallets() {
  try {
    localStorage.setItem(monitoredWalletStorageKey, JSON.stringify(state.monitoredWallets));
  } catch {
    // Local storage can be unavailable in private or restricted browser contexts.
  }
}

function number(value) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + (row[key] ?? 0), 0);
}

function recordTimeSort(a, b) {
  return (
    (a.unlockTime ?? "9999-12-31T23:59:59.999Z").localeCompare(b.unlockTime ?? "9999-12-31T23:59:59.999Z") ||
    a.rowNumber - b.rowNumber ||
    a.label.localeCompare(b.label)
  );
}

function recordIdSort(a, b) {
  const aRange = parseIdRange(a.baseLabel ?? a.label);
  const bRange = parseIdRange(b.baseLabel ?? b.label);
  return (
    (aRange?.start ?? Number.MAX_SAFE_INTEGER) - (bRange?.start ?? Number.MAX_SAFE_INTEGER) ||
    a.rowNumber - b.rowNumber ||
    a.label.localeCompare(b.label)
  );
}

function recordKey(record) {
  return `${record.sheet}:${record.rowNumber}:${record.label}:${record.unlockTime ?? ""}`;
}

function dedupeRecords(records) {
  const byKey = new Map();
  for (const record of records) {
    byKey.set(recordKey(record), record);
  }
  return [...byKey.values()];
}

function parseIdRange(label) {
  const match = String(label).match(/(\d+)\s*-\s*(\d+)/);
  if (!match) {
    return null;
  }
  return {
    start: Number.parseInt(match[1], 10),
    end: Number.parseInt(match[2], 10),
  };
}

function formatIdRange(start, end) {
  return start === end ? String(start) : `${start}-${end}`;
}

function mergedRecordRange(records) {
  const ranges = records.map((record) => parseIdRange(record.label)).filter(Boolean);
  if (ranges.length === 0) {
    return "-";
  }
  return `${number(ranges[0].start)}-${number(ranges.at(-1).end)}`;
}

function isTodayUnlock(isoDateTime) {
  return Boolean(isoDateTime) && localDateKey(new Date(isoDateTime)) === localDateKey(new Date());
}

function isPastUnlock(isoDateTime) {
  return Boolean(isoDateTime) && Date.parse(isoDateTime) <= Date.now();
}

function isWithinLocalDays(isoDateTime, days) {
  if (!isoDateTime) {
    return false;
  }
  const today = localDateKey(new Date());
  const target = localDateKey(new Date(isoDateTime));
  const diff = daysBetweenIso(today, target);
  return diff >= 0 && diff <= days;
}

function localDateKey(date) {
  const { year, month, day } = localDateParts(date);
  return `${year}-${month}-${day}`;
}

function localDateParts(date) {
  return formatterParts(userDateFormatter, date);
}

function localDateTimeParts(date) {
  return formatterParts(userDateTimeFormatter, date);
}

function formatterParts(formatter, date) {
  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      parts[part.type] = part.value;
    }
  }
  return parts;
}

function walletDisplayName(sheet) {
  return String(sheet).split("-")[0] || String(sheet);
}

function nextChainId(row) {
  if (row.chainMinted != null) {
    return row.chainMinted + 1;
  }
  return (row.sheetMintedIds ?? 0) + 1;
}

function addDaysIso(today, days) {
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function consoleToday() {
  return localDateKey(new Date());
}

function daysBetweenIso(start, end) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`);
  return Math.round(diff / msPerDay);
}

function formatDateTime(isoDateTime) {
  const { year, month, day, hour, minute } = localDateTimeParts(new Date(isoDateTime));
  return `${year}/${month}/${day} ${hour}:${minute}`;
}

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split("-");
  return `${year}/${month}/${day}`;
}

function formatWeekday(isoDate) {
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return weekdays[new Date(`${isoDate}T00:00:00`).getDay()];
}

function shortWallet(wallet) {
  if (!wallet) {
    return "-";
  }
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function shortHash(hash) {
  if (!hash) {
    return "-";
  }
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function walletErrorMessage(error) {
  if (error?.message) {
    return error.message;
  }
  return String(error);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
