import type { AddonContext } from "@wealthfolio/addon-sdk";

export const BASE_URL = "https://api.lunchmoney.dev/v2";
export const API_KEY_SECRET = "lunchmoney-api-key";

export const getApiKey = (ctx: AddonContext) => ctx.api.secrets.get(API_KEY_SECRET);
export const setApiKey = (ctx: AddonContext, key: string) =>
  ctx.api.secrets.set(API_KEY_SECRET, key);
export const clearApiKey = (ctx: AddonContext) => ctx.api.secrets.delete(API_KEY_SECRET);

export interface LunchmoneyAccount {
  id: number;
  name: string;
  display_name: string | null;
  type: string;
  subtype: string | null;
  currency: string;
  balance: string;
  institution_name?: string;
  status: string;
  /** Where the account lives in Lunch Money: added by hand, or synced from a bank. */
  source?: "manual" | "synced";
}

export class LunchMoneyApiError extends Error {
  constructor(readonly status: number) {
    super(`Lunch Money API error ${status}`);
  }
}

// The addon runs in a sandboxed iframe where `fetch` is blocked; all requests go
// through the host's network broker, which injects the bearer token from secrets
// so the API key never enters addon code. GET only — this addon is read-only.
async function fetchJson<T>(ctx: AddonContext, path: string): Promise<T> {
  const res = await ctx.api.network.request({
    url: `${BASE_URL}${path}`,
    method: "GET",
    auth: { type: "bearer", secretKey: API_KEY_SECRET },
  });
  if (res.status < 200 || res.status >= 300) {
    throw new LunchMoneyApiError(res.status);
  }
  return JSON.parse(res.body) as T;
}

/** Reads a Lunch Money path and returns its parsed JSON (GET only). */
export type LunchMoneyGet = <T>(path: string) => Promise<T>;

/**
 * Manual and bank-synced accounts, credit cards left out. Shared by the add-on
 * and the companion, which each bring their own GET. Throws only when neither
 * list can be read.
 */
export async function fetchAccountsWith(getJson: LunchMoneyGet): Promise<LunchmoneyAccount[]> {
  const [manualResult, plaidResult] = await Promise.allSettled([
    getJson<{ manual_accounts: LunchmoneyAccount[] }>("/manual_accounts"),
    getJson<{ plaid_accounts: LunchmoneyAccount[] }>("/plaid_accounts"),
  ]);
  if (manualResult.status === "rejected" && plaidResult.status === "rejected") {
    throw manualResult.reason;
  }
  const manual = manualResult.status === "fulfilled" ? manualResult.value.manual_accounts : [];
  const plaid = plaidResult.status === "fulfilled" ? plaidResult.value.plaid_accounts : [];
  return [
    ...manual.map((a) => ({ ...a, source: "manual" as const })),
    ...plaid.map((a) => ({ ...a, source: "synced" as const })),
  ].filter((a) => !isCreditCard(a));
}

export async function fetchAllAccounts(ctx: AddonContext): Promise<LunchmoneyAccount[]> {
  return fetchAccountsWith((path) => fetchJson(ctx, path)).catch(() => []);
}

/**
 * Wealthfolio tracks credit cards from their transactions and its snapshot API
 * only takes balances for holdings accounts, so the add-on ignores them entirely.
 */
const isCreditCard = (a: LunchmoneyAccount) => a.type?.toLowerCase() === "credit";

export type ConnectionStatus =
  | { ok: true; budgetName: string; userName: string }
  | { ok: false; reason: "unauthorized" }
  | { ok: false; reason: "error"; message: string };

/** Checks the saved token by asking Lunch Money who it belongs to (read-only). */
export async function checkConnection(ctx: AddonContext): Promise<ConnectionStatus> {
  try {
    const me = await fetchJson<{ name: string; budget_name: string }>(ctx, "/me");
    return { ok: true, budgetName: me.budget_name, userName: me.name };
  } catch (err) {
    if (err instanceof LunchMoneyApiError && (err.status === 401 || err.status === 403)) {
      return { ok: false, reason: "unauthorized" };
    }
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
