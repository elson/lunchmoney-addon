import type { AddonContext } from "@wealthfolio/addon-sdk";

const BASE_URL = "https://api.lunchmoney.dev/v2";
const API_KEY_SECRET = "lunchmoney-api-key";

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
    throw new Error(`Lunch Money API error ${res.status}`);
  }
  return JSON.parse(res.body) as T;
}

export async function fetchAllAccounts(ctx: AddonContext): Promise<LunchmoneyAccount[]> {
  const [manualResult, plaidResult] = await Promise.allSettled([
    fetchJson<{ manual_accounts: LunchmoneyAccount[] }>(ctx, "/manual_accounts"),
    fetchJson<{ plaid_accounts: LunchmoneyAccount[] }>(ctx, "/plaid_accounts"),
  ]);
  const manual = manualResult.status === "fulfilled" ? manualResult.value.manual_accounts : [];
  const plaid = plaidResult.status === "fulfilled" ? plaidResult.value.plaid_accounts : [];
  return [
    ...manual.map((a) => ({ ...a, source: "manual" as const })),
    ...plaid.map((a) => ({ ...a, source: "synced" as const })),
  ];
}
