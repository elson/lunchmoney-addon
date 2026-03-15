import type { AddonContext, Account } from "@wealthfolio/addon-sdk";
import type { LunchmoneyAccount } from "./lunchmoney";

export async function createWfAccountFromLm(
  ctx: AddonContext,
  lm: LunchmoneyAccount,
): Promise<Account> {
  return ctx.api.accounts.create({
    name: lm.display_name || lm.name,
    accountType: "CASH",
    currency: lm.currency.toUpperCase(),
    isDefault: false,
    isActive: true,
    trackingMode: "HOLDINGS",
    group: lm.institution_name || undefined,
  });
}

// Option B: direct REST call until SDK exposes saveManualHoldings (Option A).
// In dev mode the webview is served from HTTP, so window.location.origin works.
// In Tauri native builds we probe the known dev-server port range.
let _wfOriginCache: string | null = null;

async function getWfOrigin(): Promise<string> {
  if (_wfOriginCache) return _wfOriginCache;
  const origin = window.location.origin;
  if (origin.startsWith("http://") || origin.startsWith("https://")) {
    _wfOriginCache = origin;
    return origin;
  }
  // Tauri native: probe known Wealthfolio dev-server ports
  for (const port of [3001, 3002, 3003, 3000]) {
    try {
      const res = await fetch(`http://localhost:${port}/api/v1/accounts`, {
        signal: AbortSignal.timeout(500),
      });
      if (res.ok || res.status === 401 || res.status === 403) {
        _wfOriginCache = `http://localhost:${port}`;
        return _wfOriginCache;
      }
    } catch {
      /* port not available, try next */
    }
  }
  throw new Error("Wealthfolio local server not found on known ports");
}

export async function saveSnapshot(
  wfAccountId: string,
  currency: string,
  balance: string,
  snapshotDate: string,
): Promise<void> {
  const origin = await getWfOrigin();
  const res = await fetch(`${origin}/api/v1/snapshots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accountId: wfAccountId,
      holdings: [],
      cashBalances: { [currency.toUpperCase()]: balance },
      snapshotDate,
    }),
  });
  if (!res.ok) {
    throw new Error(`Snapshot save failed: ${res.status} ${res.statusText}`);
  }
}
