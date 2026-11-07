import { describe, expect, it, vi } from "vitest";
import type { AddonContext } from "@wealthfolio/addon-sdk";
import { checkConnection, fetchAllAccounts } from "../lunchmoney";
import { createMockCtx } from "../../test/mockCtx";

const makeAccount = (id: number) => ({
  id,
  name: `Account ${id}`,
  display_name: null,
  type: "cash",
  subtype: null,
  currency: "usd",
  balance: "100.00",
  status: "active",
});

type MockResponse = { status: number; data?: unknown };

function mockNetwork(ctx: AddonContext, responses: Record<string, MockResponse>) {
  vi.mocked(ctx.api.network.request).mockImplementation(({ url }) => {
    const path = new URL(url).pathname.replace(/^\/v2/, "");
    const res = responses[path];
    if (!res) return Promise.reject(new Error(`Unexpected request to ${url}`));
    return Promise.resolve({
      status: res.status,
      headers: {},
      body: res.data === undefined ? "" : JSON.stringify(res.data),
    });
  });
}

describe("fetchAllAccounts", () => {
  it("requests both endpoints via the host network broker with bearer auth from secrets", async () => {
    const ctx = createMockCtx();
    mockNetwork(ctx, {
      "/manual_accounts": { status: 200, data: { manual_accounts: [] } },
      "/plaid_accounts": { status: 200, data: { plaid_accounts: [] } },
    });
    await fetchAllAccounts(ctx);
    const calls = vi.mocked(ctx.api.network.request).mock.calls.map(([req]) => req);
    expect(calls.map((c) => c.url).sort()).toEqual([
      "https://api.lunchmoney.dev/v2/manual_accounts",
      "https://api.lunchmoney.dev/v2/plaid_accounts",
    ]);
    for (const c of calls) {
      expect(c.method).toBe("GET");
      expect(c.auth).toEqual({ type: "bearer", secretKey: "lunchmoney-api-key" });
    }
  });

  it("merges manual and plaid accounts", async () => {
    const ctx = createMockCtx();
    mockNetwork(ctx, {
      "/manual_accounts": { status: 200, data: { manual_accounts: [makeAccount(1)] } },
      "/plaid_accounts": { status: 200, data: { plaid_accounts: [makeAccount(2)] } },
    });
    const result = await fetchAllAccounts(ctx);
    expect(result.map((a) => a.id)).toEqual([1, 2]);
  });

  it("tags each account with where it comes from, so look-alike accounts can be told apart", async () => {
    const ctx = createMockCtx();
    mockNetwork(ctx, {
      "/manual_accounts": { status: 200, data: { manual_accounts: [makeAccount(1)] } },
      "/plaid_accounts": { status: 200, data: { plaid_accounts: [makeAccount(2)] } },
    });
    const result = await fetchAllAccounts(ctx);
    expect(result.map((a) => [a.id, a.source])).toEqual([
      [1, "manual"],
      [2, "synced"],
    ]);
  });

  it("returns only manual accounts when plaid fails", async () => {
    const ctx = createMockCtx();
    mockNetwork(ctx, {
      "/manual_accounts": { status: 200, data: { manual_accounts: [makeAccount(1)] } },
      "/plaid_accounts": { status: 403 },
    });
    const result = await fetchAllAccounts(ctx);
    expect(result.map((a) => a.id)).toEqual([1]);
  });

  it("returns only plaid accounts when manual fails", async () => {
    const ctx = createMockCtx();
    mockNetwork(ctx, {
      "/manual_accounts": { status: 500 },
      "/plaid_accounts": { status: 200, data: { plaid_accounts: [makeAccount(2)] } },
    });
    const result = await fetchAllAccounts(ctx);
    expect(result.map((a) => a.id)).toEqual([2]);
  });

  it("returns empty array when both fail", async () => {
    const ctx = createMockCtx();
    mockNetwork(ctx, {
      "/manual_accounts": { status: 401 },
      "/plaid_accounts": { status: 401 },
    });
    expect(await fetchAllAccounts(ctx)).toEqual([]);
  });

  it("treats a broker rejection as a failed endpoint", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.network.request).mockRejectedValue(new Error("host not allowed"));
    expect(await fetchAllAccounts(ctx)).toEqual([]);
  });

  it("treats an unparseable body as a failed endpoint", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.network.request).mockResolvedValue({
      status: 200,
      headers: {},
      body: "<html>",
    });
    expect(await fetchAllAccounts(ctx)).toEqual([]);
  });
});

describe("checkConnection", () => {
  it("reports the budget and user the saved token belongs to", async () => {
    const ctx = createMockCtx();
    mockNetwork(ctx, {
      "/me": { status: 200, data: { name: "Stephen", budget_name: "Family budget" } },
    });
    expect(await checkConnection(ctx)).toEqual({
      ok: true,
      budgetName: "Family budget",
      userName: "Stephen",
    });
    expect(vi.mocked(ctx.api.network.request).mock.calls[0][0]).toMatchObject({
      method: "GET",
      auth: { type: "bearer", secretKey: "lunchmoney-api-key" },
    });
  });

  it("reports a rejected token separately from other failures", async () => {
    const ctx = createMockCtx();
    mockNetwork(ctx, { "/me": { status: 401 } });
    expect(await checkConnection(ctx)).toEqual({ ok: false, reason: "unauthorized" });
  });

  it("reports other failures as errors with the message", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.network.request).mockRejectedValue(new Error("offline"));
    expect(await checkConnection(ctx)).toEqual({ ok: false, reason: "error", message: "offline" });
  });
});
