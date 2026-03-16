const BASE_URL = "https://api.lunchmoney.dev/v2";

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
}

async function fetchJson<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Lunch Money API error ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchAllAccounts(apiKey: string): Promise<LunchmoneyAccount[]> {
  const [manualResult, plaidResult] = await Promise.allSettled([
    fetchJson<{ manual_accounts: LunchmoneyAccount[] }>("/manual_accounts", apiKey),
    fetchJson<{ plaid_accounts: LunchmoneyAccount[] }>("/plaid_accounts", apiKey),
  ]);
  const manual = manualResult.status === "fulfilled" ? manualResult.value.manual_accounts : [];
  const plaid = plaidResult.status === "fulfilled" ? plaidResult.value.plaid_accounts : [];
  return [...manual, ...plaid];
}
