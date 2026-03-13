const BASE_URL = 'https://api.lunchmoney.dev/v2';

export interface LunchmoneyAccount {
  id: number;
  name: string;
  display_name: string | null;
  type: string;
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
    throw new Error(`Lunchmoney API error ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchAllAccounts(apiKey: string): Promise<LunchmoneyAccount[]> {
  const [manualRes, plaidRes] = await Promise.all([
    fetchJson<{ manual_accounts: LunchmoneyAccount[] }>('/manual_accounts', apiKey),
    fetchJson<{ plaid_accounts: LunchmoneyAccount[] }>('/plaid_accounts', apiKey),
  ]);
  return [...manualRes.manual_accounts, ...plaidRes.plaid_accounts];
}
