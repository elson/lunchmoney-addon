import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAllAccounts } from "../lunchmoney";

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

function mockFetch(responses: { ok: boolean; status?: number; data?: unknown }[]) {
  let call = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() => {
      const res = responses[call++];
      if (!res) throw new Error("Unexpected fetch call");
      if (!res.ok) {
        return Promise.resolve({
          ok: false,
          status: res.status ?? 500,
          statusText: "Error",
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(res.data),
      });
    }),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchAllAccounts", () => {
  it("merges manual and plaid accounts", async () => {
    mockFetch([
      { ok: true, data: { manual_accounts: [makeAccount(1)] } },
      { ok: true, data: { plaid_accounts: [makeAccount(2)] } },
    ]);
    const result = await fetchAllAccounts("key");
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
  });

  it("returns only manual accounts when plaid rejects", async () => {
    mockFetch([
      { ok: true, data: { manual_accounts: [makeAccount(1)] } },
      { ok: false, status: 403 },
    ]);
    const result = await fetchAllAccounts("key");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("returns only plaid accounts when manual rejects", async () => {
    mockFetch([
      { ok: false, status: 500 },
      { ok: true, data: { plaid_accounts: [makeAccount(2)] } },
    ]);
    const result = await fetchAllAccounts("key");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it("returns empty array when both reject", async () => {
    mockFetch([
      { ok: false, status: 500 },
      { ok: false, status: 500 },
    ]);
    const result = await fetchAllAccounts("key");
    expect(result).toEqual([]);
  });

  it("throws when response is not ok (inside fetchJson)", async () => {
    // fetchJson throws on !ok; allSettled catches that, so the result is empty
    mockFetch([
      { ok: false, status: 401 },
      { ok: false, status: 401 },
    ]);
    const result = await fetchAllAccounts("key");
    expect(result).toEqual([]);
  });
});
