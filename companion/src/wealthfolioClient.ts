/**
 * The few Wealthfolio server endpoints a balance sync needs: the same calls
 * the add-on makes through `ctx.api`, over Wealthfolio's REST API (`/api/v1`).
 */
export class WealthfolioError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WealthfolioError";
  }
}

const SESSION_COOKIE = /(?:^|;\s*)wf_session=([^;]+)/;

export class WealthfolioClient {
  private readonly baseUrl: string;
  private token: string | null = null;

  constructor(
    baseUrl: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  /** Signs in with the server password; the session cookie becomes a bearer token. */
  async login(password: string): Promise<void> {
    const res = await this.fetchFn(`${this.baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      throw new WealthfolioError(
        `Wealthfolio rejected the password (HTTP ${res.status})`,
        res.status,
      );
    }
    const cookies = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""];
    for (const cookie of cookies) {
      const match = SESSION_COOKIE.exec(cookie);
      if (match) {
        this.token = match[1];
        return;
      }
    }
    throw new WealthfolioError("Wealthfolio signed in but sent no wf_session cookie", res.status);
  }

  async getAccountIds(): Promise<string[]> {
    const accounts = await this.request<Array<{ id: string | number }>>("GET", "/accounts");
    return accounts.map((a) => String(a.id));
  }

  async getLatestCashBalances(accountIds: readonly string[]): Promise<Record<string, number>> {
    if (accountIds.length === 0) return {};
    const query = new URLSearchParams(accountIds.map((id) => ["accountIds", id]));
    const valuations = await this.request<
      Array<{ accountId: string; cashBalance: string | number }>
    >("GET", `/valuations/latest?${query}`);
    return Object.fromEntries(valuations.map((v) => [v.accountId, Number(v.cashBalance)]));
  }

  async saveCashSnapshot(
    accountId: string,
    currency: string,
    balance: string,
    snapshotDate: string,
  ): Promise<void> {
    await this.request("POST", "/snapshots", {
      accountId,
      holdings: [],
      cashBalances: { [currency]: balance },
      snapshotDate,
    });
  }

  async updatePortfolio(): Promise<void> {
    await this.request("POST", "/portfolio/update");
  }

  getAddonSecret(addonId: string, key: string): Promise<string | null> {
    const query = new URLSearchParams({ key });
    return this.request("GET", `/addons/${encodeURIComponent(addonId)}/secrets?${query}`);
  }

  getAddonStorage(addonId: string, key: string): Promise<string | null> {
    return this.request("GET", this.storagePath(addonId, key));
  }

  async setAddonStorage(addonId: string, key: string, value: string): Promise<void> {
    await this.request("PUT", this.storagePath(addonId, key), { value });
  }

  private storagePath(addonId: string, key: string): string {
    return `/addons/storage/${encodeURIComponent(addonId)}/${encodeURIComponent(key)}`;
  }

  /** Sends one request. The error names the call and status only: bodies can echo secrets. */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await this.fetchFn(`${this.baseUrl}/api/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const route = path.split("?")[0];
      throw new WealthfolioError(
        `Wealthfolio ${method} /api/v1${route} failed (HTTP ${res.status})`,
        res.status,
      );
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }
}
