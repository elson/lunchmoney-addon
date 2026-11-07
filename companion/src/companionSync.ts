import {
  runBalanceSync,
  type BalanceSyncHost,
  type BalanceSyncOutcome,
} from "../../src/lib/balanceSync";
import {
  API_KEY_SECRET,
  BASE_URL,
  LunchMoneyApiError,
  fetchAccountsWith,
  type LunchMoneyGet,
} from "../../src/lib/lunchmoney";
import {
  LAST_SYNCED_STORAGE_KEY,
  MAPPING_STORAGE_KEY,
  deserializeMapping,
} from "../../src/lib/mapping";
import {
  ADDON_VERSION_STORAGE_KEY,
  COMPANION_STORAGE_KEY,
  VERSION,
  versionMismatch,
} from "../../src/lib/version";
import type { WealthfolioClient } from "./wealthfolioClient";

/** The add-on's manifest id: its secrets and storage live under it. */
export const ADDON_ID = "lunchmoney-addon";

/** GET-only access to Lunch Money. The companion never writes to Lunch Money. */
export function createLunchMoneyGet(token: string, fetchFn: typeof fetch): LunchMoneyGet {
  return async <T>(path: string): Promise<T> => {
    const res = await fetchFn(`${BASE_URL}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) throw new LunchMoneyApiError(res.status);
    return (await res.json()) as T;
  };
}

interface HostOptions {
  now: () => number;
  log: (message: string) => void;
}

/** The balance sync's host outside Wealthfolio: its REST API, with the add-on's own settings. */
export function createRestHost(
  wf: WealthfolioClient,
  lmGet: LunchMoneyGet,
  { now, log }: HostOptions,
): BalanceSyncHost {
  return {
    fetchLunchMoneyAccounts: () => fetchAccountsWith(lmGet),
    loadMapping: async () =>
      deserializeMapping(await wf.getAddonStorage(ADDON_ID, MAPPING_STORAGE_KEY)),
    listWealthfolioAccountIds: () => wf.getAccountIds(),
    latestCashBalances: (ids) => wf.getLatestCashBalances(ids),
    saveCashSnapshot: (id, currency, balance, date) =>
      wf.saveCashSnapshot(id, currency, balance, date),
    updatePortfolio: () => wf.updatePortfolio(),
    saveLastSynced: () => wf.setAddonStorage(ADDON_ID, LAST_SYNCED_STORAGE_KEY, String(now())),
    logError: log,
  };
}

export interface SyncOnceOptions extends HostOptions {
  wf: WealthfolioClient;
  password: string;
  fetchFn: typeof fetch;
  /** Told the add-on's recorded version (null if it hasn't recorded one) on each run. */
  onAddonVersion?: (version: string | null) => void;
}

/**
 * Records this companion's version for the add-on to compare, and compares the
 * add-on's. A failure here is logged, not fatal: the sync doesn't depend on it.
 */
async function checkVersions(
  wf: WealthfolioClient,
  { now, log, onAddonVersion }: Pick<SyncOnceOptions, "now" | "log" | "onAddonVersion">,
): Promise<void> {
  try {
    await wf.setAddonStorage(
      ADDON_ID,
      COMPANION_STORAGE_KEY,
      JSON.stringify({ version: VERSION, lastRunAt: new Date(now()).toISOString() }),
    );
    const addonVersion = await wf.getAddonStorage(ADDON_ID, ADDON_VERSION_STORAGE_KEY);
    onAddonVersion?.(addonVersion);
    const mismatch = addonVersion && versionMismatch({ addon: addonVersion, companion: VERSION });
    if (mismatch) log(`WARNING: ${mismatch.message}`);
  } catch (err) {
    log(`WARNING: couldn't check versions with the add-on: ${errorText(err)}`);
  }
}

/** One unattended sync. Errors come back as a failed outcome rather than being thrown. */
export async function syncOnce({
  wf,
  password,
  fetchFn,
  now,
  log,
  onAddonVersion,
}: SyncOnceOptions): Promise<BalanceSyncOutcome> {
  try {
    await wf.login(password);
    await checkVersions(wf, { now, log, onAddonVersion });
    const token = await wf.getAddonSecret(ADDON_ID, API_KEY_SECRET);
    if (!token) {
      return {
        status: "failed",
        errors: ["No Lunch Money token is saved in the add-on's settings"],
      };
    }
    const host = createRestHost(wf, createLunchMoneyGet(token, fetchFn), { now, log });
    return await runBalanceSync(host, new Date(now()).toISOString().slice(0, 10));
  } catch (err) {
    return { status: "failed", errors: [errorText(err)] };
  }
}

/** Node's fetch says only "fetch failed"; the reason (refused, DNS, TLS) is in its cause. */
function errorText(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const { cause } = err as { cause?: unknown };
  return cause instanceof Error ? `${err.message} (${cause.message})` : err.message;
}
