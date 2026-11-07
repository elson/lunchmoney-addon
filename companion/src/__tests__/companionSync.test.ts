// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import manifest from "../../../manifest.json";
import { ADDON_ID, createLunchMoneyGet, createRestHost, syncOnce } from "../companionSync";
import type { WealthfolioClient } from "../wealthfolioClient";
import { VERSION } from "../../../src/lib/version";

function fakeWealthfolio(overrides: Partial<Record<keyof WealthfolioClient, unknown>> = {}) {
  return {
    login: vi.fn().mockResolvedValue(undefined),
    getAccountIds: vi.fn().mockResolvedValue(["w1"]),
    getLatestCashBalances: vi.fn().mockResolvedValue({ w1: 90 }),
    saveCashSnapshot: vi.fn().mockResolvedValue(undefined),
    updatePortfolio: vi.fn().mockResolvedValue(undefined),
    getAddonSecret: vi.fn().mockResolvedValue("lm-token"),
    getAddonStorage: vi
      .fn()
      .mockResolvedValue(JSON.stringify({ 1: { type: "existing", wfAccountId: "w1" } })),
    setAddonStorage: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as WealthfolioClient;
}

const lmAccounts = {
  "/manual_accounts": {
    manual_accounts: [
      {
        id: 1,
        name: "Checking",
        display_name: null,
        type: "cash",
        subtype: null,
        currency: "usd",
        balance: "100.00",
        status: "active",
      },
    ],
  },
  "/plaid_accounts": { plaid_accounts: [] },
};

function fakeLunchMoneyFetch(status = 200) {
  return vi.fn(async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname.replace(/^\/v2/, "");
    return new Response(JSON.stringify(lmAccounts[path as keyof typeof lmAccounts]), { status });
  }) as unknown as typeof fetch;
}

describe("ADDON_ID", () => {
  it("is the add-on's manifest id, so the companion reads the add-on's own settings", () => {
    expect(ADDON_ID).toBe(manifest.id);
  });
});

describe("createLunchMoneyGet", () => {
  it("sends a GET with the token as a bearer token and parses the JSON", async () => {
    const fetchFn = vi.fn(async () => new Response('{"ok":true}')) as unknown as typeof fetch;
    expect(await createLunchMoneyGet("tok", fetchFn)("/me")).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledWith("https://api.lunchmoney.dev/v2/me", {
      method: "GET",
      headers: { Authorization: "Bearer tok", Accept: "application/json" },
    });
  });

  it("fails with the status, not the body", async () => {
    const fetchFn = vi.fn(
      async () => new Response("secret stuff", { status: 401 }),
    ) as unknown as typeof fetch;
    await expect(createLunchMoneyGet("tok", fetchFn)("/me")).rejects.toThrow(
      "Lunch Money API error 401",
    );
  });
});

describe("createRestHost", () => {
  it("reads the links the add-on saved, and records the sync time where the add-on shows it", async () => {
    const wf = fakeWealthfolio();
    const host = createRestHost(wf, vi.fn(), { now: () => 1234, log: vi.fn() });

    expect(await host.loadMapping()).toEqual({ 1: { type: "existing", wfAccountId: "w1" } });
    expect(wf.getAddonStorage).toHaveBeenCalledWith(ADDON_ID, "lunchmoney-addon:account-mapping");

    await host.saveLastSynced();
    expect(wf.setAddonStorage).toHaveBeenCalledWith(
      ADDON_ID,
      "lunchmoney-addon:last-synced",
      "1234",
    );
  });

  it("treats no saved links as none", async () => {
    const host = createRestHost(
      fakeWealthfolio({ getAddonStorage: vi.fn().mockResolvedValue(null) }),
      vi.fn(),
      {
        now: Date.now,
        log: vi.fn(),
      },
    );
    expect(await host.loadMapping()).toEqual({});
  });

  it("passes the remaining calls through to Wealthfolio and the log", async () => {
    const wf = fakeWealthfolio();
    const log = vi.fn();
    const host = createRestHost(wf, vi.fn(), { now: Date.now, log });

    expect(await host.listWealthfolioAccountIds()).toEqual(["w1"]);
    expect(await host.latestCashBalances(["w1"])).toEqual({ w1: 90 });
    await host.saveCashSnapshot("w1", "USD", "1.00", "2026-11-07");
    await host.updatePortfolio();
    host.logError("bad");

    expect(wf.saveCashSnapshot).toHaveBeenCalledWith("w1", "USD", "1.00", "2026-11-07");
    expect(wf.updatePortfolio).toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("bad");
  });
});

describe("syncOnce", () => {
  it("signs in, uses the add-on's Lunch Money token, and imports changed balances", async () => {
    const wf = fakeWealthfolio();
    const fetchFn = fakeLunchMoneyFetch();

    const outcome = await syncOnce({
      wf,
      password: "pw",
      fetchFn,
      now: () => Date.parse("2026-11-07T06:00:00Z"),
      log: vi.fn(),
    });

    expect(wf.login).toHaveBeenCalledWith("pw");
    expect(wf.getAddonSecret).toHaveBeenCalledWith(ADDON_ID, "lunchmoney-api-key");
    expect(wf.saveCashSnapshot).toHaveBeenCalledWith("w1", "USD", "100.00", "2026-11-07");
    expect(outcome).toEqual({ status: "synced", checked: 1, imported: 1 });
  });

  it("only ever reads from Lunch Money", async () => {
    const fetchFn = fakeLunchMoneyFetch();
    await syncOnce({ wf: fakeWealthfolio(), password: "pw", fetchFn, now: Date.now, log: vi.fn() });
    const methods = vi.mocked(fetchFn).mock.calls.map(([, init]) => init?.method);
    expect(methods.length).toBeGreaterThan(0);
    expect(methods.every((m) => m === "GET")).toBe(true);
  });

  it("fails without calling Lunch Money when the add-on has no token", async () => {
    const fetchFn = fakeLunchMoneyFetch();
    const outcome = await syncOnce({
      wf: fakeWealthfolio({ getAddonSecret: vi.fn().mockResolvedValue(null) }),
      password: "pw",
      fetchFn,
      now: Date.now,
      log: vi.fn(),
    });
    expect(outcome).toEqual({
      status: "failed",
      errors: ["No Lunch Money token is saved in the add-on's settings"],
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("surfaces a Lunch Money error instead of reporting no accounts", async () => {
    const outcome = await syncOnce({
      wf: fakeWealthfolio(),
      password: "pw",
      fetchFn: fakeLunchMoneyFetch(401),
      now: Date.now,
      log: vi.fn(),
    });
    expect(outcome).toEqual({ status: "failed", errors: ["Lunch Money API error 401"] });
  });

  it("names the cause of a network failure", async () => {
    const offline = Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("connect ECONNREFUSED 10.0.0.2:8088"), {
        code: "ECONNREFUSED",
      }),
    });
    const outcome = await syncOnce({
      wf: fakeWealthfolio({ login: vi.fn().mockRejectedValue(offline) }),
      password: "pw",
      fetchFn: fakeLunchMoneyFetch(),
      now: Date.now,
      log: vi.fn(),
    });
    expect(outcome).toEqual({
      status: "failed",
      errors: ["fetch failed (connect ECONNREFUSED 10.0.0.2:8088)"],
    });
  });
});

describe("syncOnce version check", () => {
  const storage = (addonVersion: string | null) =>
    vi.fn(async (_id: string, key: string) =>
      key === "lunchmoney-addon:addon-version"
        ? addonVersion
        : JSON.stringify({ 1: { type: "existing", wfAccountId: "w1" } }),
    );

  it("records its version and run time where the add-on reads them", async () => {
    const wf = fakeWealthfolio({ getAddonStorage: storage(VERSION) });
    await syncOnce({
      wf,
      password: "pw",
      fetchFn: fakeLunchMoneyFetch(),
      now: () => Date.parse("2026-11-07T06:00:00Z"),
      log: vi.fn(),
    });
    expect(wf.setAddonStorage).toHaveBeenCalledWith(
      ADDON_ID,
      "lunchmoney-addon:companion",
      JSON.stringify({ version: VERSION, lastRunAt: "2026-11-07T06:00:00.000Z" }),
    );
  });

  it("reports the add-on's version, and warns when it differs", async () => {
    const log = vi.fn();
    const onAddonVersion = vi.fn();
    await syncOnce({
      wf: fakeWealthfolio({ getAddonStorage: storage("0.0.1") }),
      password: "pw",
      fetchFn: fakeLunchMoneyFetch(),
      now: Date.now,
      log,
      onAddonVersion,
    });
    expect(onAddonVersion).toHaveBeenCalledWith("0.0.1");
    expect(log).toHaveBeenCalledWith(
      `WARNING: The add-on is on v0.0.1 but the sync companion is on v${VERSION}. Install the latest add-on release.`,
    );
  });

  it("doesn't warn when the versions match or the add-on hasn't recorded one", async () => {
    for (const version of [VERSION, null]) {
      const log = vi.fn();
      await syncOnce({
        wf: fakeWealthfolio({ getAddonStorage: storage(version) }),
        password: "pw",
        fetchFn: fakeLunchMoneyFetch(),
        now: Date.now,
        log,
      });
      expect(log.mock.calls.flat().some((m: string) => m.startsWith("WARNING"))).toBe(false);
    }
  });

  it("still syncs when the version can't be recorded", async () => {
    const log = vi.fn();
    const outcome = await syncOnce({
      wf: fakeWealthfolio({ setAddonStorage: vi.fn().mockRejectedValue(new Error("nope")) }),
      password: "pw",
      fetchFn: fakeLunchMoneyFetch(),
      now: Date.now,
      log,
    });
    expect(log).toHaveBeenCalledWith("WARNING: couldn't check versions with the add-on: nope");
    expect(outcome.status).toBe("failed"); // saving the sync time uses the same storage
  });
});
