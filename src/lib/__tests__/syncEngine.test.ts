import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSyncEngine } from "../syncEngine";
import { createMockCtx } from "../../test/mockCtx";
import type { LunchmoneyAccount } from "../lunchmoney";

vi.mock("../lunchmoney", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, fetchAllAccounts: vi.fn() };
});

import { fetchAllAccounts } from "../lunchmoney";

const lm = (id: number, wfAccountId?: string): LunchmoneyAccount => ({
  id,
  name: `LM ${id}`,
  display_name: null,
  type: "cash",
  subtype: null,
  currency: "usd",
  balance: "100.00",
  status: "active",
  ...(wfAccountId ? {} : {}),
});

const wfAccount = (id: string) => ({
  id,
  name: `WF ${id}`,
  accountType: "CASH",
  currency: "USD",
  isDefault: false,
  isActive: true,
  trackingMode: "HOLDINGS",
});

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.mocked(fetchAllAccounts).mockResolvedValue([]);
});

// ─── loadAll ──────────────────────────────────────────────────────────────────

describe("loadAll", () => {
  it("fetches LM accounts, WF accounts, and mapping in parallel", async () => {
    const ctx = createMockCtx();
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([wfAccount("w1")] as never);

    const engine = createSyncEngine(ctx);
    const result = await engine.loadAll("test-key");

    expect(fetchAllAccounts).toHaveBeenCalledWith("test-key");
    expect(ctx.api.accounts.getAll).toHaveBeenCalled();
    expect(result.lmAccounts).toHaveLength(1);
    expect(result.wfAccounts).toHaveLength(1);
  });

  it("cleans mapping and auto-saves when stale entries are removed", async () => {
    localStorage.setItem(
      "lunchmoney-addon:account-mapping",
      JSON.stringify({
        1: { type: "ignore" },
        2: { type: "ignore" }, // id 2 deleted from LM
      }),
    );
    const ctx = createMockCtx();
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]); // only id 1 returned
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([] as never);

    const engine = createSyncEngine(ctx);
    const result = await engine.loadAll("test-key");

    expect(result.savedMapping).toEqual({ 1: { type: "ignore" } });
    const stored = localStorage.getItem("lunchmoney-addon:account-mapping");
    expect(stored).toBe(JSON.stringify({ 1: { type: "ignore" } }));
  });

  it("does not auto-save when no stale entries are removed", async () => {
    localStorage.setItem(
      "lunchmoney-addon:account-mapping",
      JSON.stringify({ 1: { type: "existing", wfAccountId: "w1" } }),
    );
    const ctx = createMockCtx();
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([wfAccount("w1")] as never);

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const engine = createSyncEngine(ctx);
    await engine.loadAll("test-key");

    const mappingCalls = setItemSpy.mock.calls.filter(([key]) => key.includes("account-mapping"));
    expect(mappingCalls).toHaveLength(0);
  });

  it("returns wfCashBalances for existing mappings", async () => {
    localStorage.setItem(
      "lunchmoney-addon:account-mapping",
      JSON.stringify({ 1: { type: "existing", wfAccountId: "w1" } }),
    );
    const ctx = createMockCtx();
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([wfAccount("w1")] as never);
    vi.mocked(ctx.api.portfolio.getLatestValuations).mockResolvedValue([
      { accountId: "w1", cashBalance: 250.0 } as never,
    ]);

    const engine = createSyncEngine(ctx);
    const result = await engine.loadAll("test-key");

    expect(result.wfCashBalances).toEqual({ w1: 250.0 });
  });

  it("returns empty wfCashBalances when no existing mappings", async () => {
    const ctx = createMockCtx();
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([] as never);

    const engine = createSyncEngine(ctx);
    const result = await engine.loadAll("test-key");

    expect(result.wfCashBalances).toEqual({});
    expect(ctx.api.portfolio.getLatestValuations).not.toHaveBeenCalled();
  });

  it("returns empty wfCashBalances when valuation fetch fails (non-fatal)", async () => {
    localStorage.setItem(
      "lunchmoney-addon:account-mapping",
      JSON.stringify({ 1: { type: "existing", wfAccountId: "w1" } }),
    );
    const ctx = createMockCtx();
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([wfAccount("w1")] as never);
    vi.mocked(ctx.api.portfolio.getLatestValuations).mockRejectedValue(new Error("Network error"));

    const engine = createSyncEngine(ctx);
    const result = await engine.loadAll("test-key");

    expect(result.wfCashBalances).toEqual({});
  });
});

// ─── confirm ──────────────────────────────────────────────────────────────────

describe("confirm", () => {
  it("creates a WF account for each 'create' entry", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.accounts.create).mockResolvedValue(wfAccount("new-1") as never);

    const engine = createSyncEngine(ctx);
    await engine.confirm({ 1: { type: "create" } }, [lm(1)]);

    expect(ctx.api.accounts.create).toHaveBeenCalledTimes(1);
    expect(ctx.api.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "LM 1", currency: "USD" }),
    );
  });

  it("remaps created entry to 'existing' with new wfAccountId", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.accounts.create).mockResolvedValue(wfAccount("new-1") as never);

    const engine = createSyncEngine(ctx);
    const result = await engine.confirm({ 1: { type: "create" } }, [lm(1)]);

    expect(result.savedMapping[1]).toEqual({ type: "existing", wfAccountId: "new-1" });
  });

  it("saves mapping to localStorage", async () => {
    const ctx = createMockCtx();
    const engine = createSyncEngine(ctx);
    await engine.confirm({ 1: { type: "ignore" } }, [lm(1)]);

    const stored = JSON.parse(localStorage.getItem("lunchmoney-addon:account-mapping")!);
    expect(stored[1]).toEqual({ type: "ignore" });
  });

  it("refreshes WF accounts and returns them", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([
      wfAccount("w1"),
      wfAccount("w2"),
    ] as never);

    const engine = createSyncEngine(ctx);
    const result = await engine.confirm({ 1: { type: "ignore" } }, [lm(1)]);

    expect(ctx.api.accounts.getAll).toHaveBeenCalled();
    expect(result.wfAccounts).toHaveLength(2);
  });

  it("skips create entries where LM account is not found", async () => {
    const ctx = createMockCtx();
    const engine = createSyncEngine(ctx);
    // lmAccounts is empty — LM id 1 won't be found
    const result = await engine.confirm({ 1: { type: "create" } }, []);

    expect(ctx.api.accounts.create).not.toHaveBeenCalled();
    // Entry stays as "create" since no LM account was found to create from
    expect(result.savedMapping[1]).toEqual({ type: "create" });
  });

  it("uses display_name when set for account creation", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.accounts.create).mockResolvedValue(wfAccount("new-1") as never);
    const lmWithDisplayName = { ...lm(1), display_name: "Pretty Name" };

    const engine = createSyncEngine(ctx);
    await engine.confirm({ 1: { type: "create" } }, [lmWithDisplayName]);

    expect(ctx.api.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Pretty Name" }),
    );
  });

  it("sets group from institution_name", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.accounts.create).mockResolvedValue(wfAccount("new-1") as never);
    const lmWithInstitution = { ...lm(1), institution_name: "Big Bank" };

    const engine = createSyncEngine(ctx);
    await engine.confirm({ 1: { type: "create" } }, [lmWithInstitution]);

    expect(ctx.api.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ group: "Big Bank" }),
    );
  });
});

// ─── syncBalances ─────────────────────────────────────────────────────────────

describe("syncBalances", () => {
  it("calls saveSnapshot for each 'existing' mapping entry", async () => {
    const ctx = createMockCtx();
    const mapping = {
      1: { type: "existing" as const, wfAccountId: "w1" },
      2: { type: "existing" as const, wfAccountId: "w2" },
    };

    const engine = createSyncEngine(ctx);
    await engine.syncBalances(mapping, [lm(1), lm(2)]);

    expect(ctx.api.snapshots.save).toHaveBeenCalledTimes(2);
  });

  it("skips non-existing entries", async () => {
    const ctx = createMockCtx();
    const mapping = {
      1: { type: "ignore" as const },
      2: { type: "create" as const },
    };

    const engine = createSyncEngine(ctx);
    await engine.syncBalances(mapping, [lm(1), lm(2)]);

    expect(ctx.api.snapshots.save).not.toHaveBeenCalled();
  });

  it("returns ok:false with accumulated errors on partial failure", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.snapshots.save).mockRejectedValue(new Error("Snapshot failed"));
    const mapping = { 1: { type: "existing" as const, wfAccountId: "w1" } };

    const engine = createSyncEngine(ctx);
    const result = await engine.syncBalances(mapping, [lm(1)]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("Snapshot failed");
    }
  });

  it("logs error for each failed snapshot", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.snapshots.save).mockRejectedValue(new Error("Snapshot failed"));
    const mapping = { 1: { type: "existing" as const, wfAccountId: "w1" } };

    const engine = createSyncEngine(ctx);
    await engine.syncBalances(mapping, [lm(1)]);

    expect(ctx.api.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Balance sync failed for LM account 1"),
    );
  });

  it("on success: saves last synced, calls portfolio.update, and returns ok:true", async () => {
    const ctx = createMockCtx();
    const mapping = { 1: { type: "existing" as const, wfAccountId: "w1" } };

    const engine = createSyncEngine(ctx);
    const result = await engine.syncBalances(mapping, [lm(1)]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lastSynced).toBeInstanceOf(Date);
    }
    expect(ctx.api.portfolio.update).toHaveBeenCalledTimes(1);
    const stored = localStorage.getItem("lunchmoney-addon:last-synced");
    expect(stored).not.toBeNull();
  });

  it("on success: returns wfCashBalances from reloaded valuations", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.portfolio.getLatestValuations).mockResolvedValue([
      { accountId: "w1", cashBalance: 500.0 } as never,
    ]);
    const mapping = { 1: { type: "existing" as const, wfAccountId: "w1" } };

    const engine = createSyncEngine(ctx);
    const result = await engine.syncBalances(mapping, [lm(1)]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.wfCashBalances).toEqual({ w1: 500.0 });
    }
  });

  it("on success: order is snapshot → portfolio.update → loadValuations", async () => {
    const ctx = createMockCtx();
    const callOrder: string[] = [];
    vi.mocked(ctx.api.snapshots.save).mockImplementation(async () => {
      callOrder.push("snapshots.save");
    });
    vi.mocked(ctx.api.portfolio.update).mockImplementation(async () => {
      callOrder.push("portfolio.update");
    });
    vi.mocked(ctx.api.portfolio.getLatestValuations).mockImplementation(async () => {
      callOrder.push("getLatestValuations");
      return [] as never;
    });
    const mapping = { 1: { type: "existing" as const, wfAccountId: "w1" } };

    const engine = createSyncEngine(ctx);
    await engine.syncBalances(mapping, [lm(1)]);

    expect(callOrder).toEqual(["snapshots.save", "portfolio.update", "getLatestValuations"]);
  });

  it("does not call portfolio.update on failure", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.snapshots.save).mockRejectedValue(new Error("fail"));
    const mapping = { 1: { type: "existing" as const, wfAccountId: "w1" } };

    const engine = createSyncEngine(ctx);
    await engine.syncBalances(mapping, [lm(1)]);

    expect(ctx.api.portfolio.update).not.toHaveBeenCalled();
  });
});
