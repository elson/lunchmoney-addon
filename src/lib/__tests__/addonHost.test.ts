import { describe, expect, it, vi } from "vitest";
import { createAddonHost } from "../addonHost";
import { createMockCtx } from "../../test/mockCtx";

vi.mock("../lunchmoney", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, fetchAllAccounts: vi.fn().mockResolvedValue([{ id: 1 }]) };
});

import { fetchAllAccounts } from "../lunchmoney";

describe("createAddonHost", () => {
  it("reads Lunch Money accounts through the add-on's network broker", async () => {
    const ctx = createMockCtx();
    expect(await createAddonHost(ctx).fetchLunchMoneyAccounts()).toEqual([{ id: 1 }]);
    expect(fetchAllAccounts).toHaveBeenCalledWith(ctx);
  });

  it("loads the saved links from add-on storage", async () => {
    const ctx = createMockCtx();
    await ctx.api.storage.set(
      "lunchmoney-addon:account-mapping",
      JSON.stringify({ 1: { type: "existing", wfAccountId: "w1" } }),
    );
    expect(await createAddonHost(ctx).loadMapping()).toEqual({
      1: { type: "existing", wfAccountId: "w1" },
    });
  });

  it("lists Wealthfolio account ids as strings", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([{ id: "w1" }, { id: 2 }] as never);
    expect(await createAddonHost(ctx).listWealthfolioAccountIds()).toEqual(["w1", "2"]);
  });

  it("returns each account's cash balance from the latest valuations", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.portfolio.getLatestValuations).mockResolvedValue([
      { accountId: "w1", cashBalance: 12.5 },
    ] as never);
    expect(await createAddonHost(ctx).latestCashBalances(["w1"])).toEqual({ w1: 12.5 });
    expect(ctx.api.portfolio.getLatestValuations).toHaveBeenCalledWith(["w1"]);
  });

  it("asks for no valuations when there are no accounts", async () => {
    const ctx = createMockCtx();
    expect(await createAddonHost(ctx).latestCashBalances([])).toEqual({});
    expect(ctx.api.portfolio.getLatestValuations).not.toHaveBeenCalled();
  });

  it("treats unreadable valuations as unknown balances", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.portfolio.getLatestValuations).mockRejectedValue(new Error("x"));
    expect(await createAddonHost(ctx).latestCashBalances(["w1"])).toEqual({});
  });

  it("saves a cash-only snapshot", async () => {
    const ctx = createMockCtx();
    await createAddonHost(ctx).saveCashSnapshot("w1", "GBP", "10.00", "2026-11-07");
    expect(ctx.api.snapshots.save).toHaveBeenCalledWith("w1", [], { GBP: "10.00" }, "2026-11-07");
  });

  it("updates the portfolio, records the sync time and logs errors through the host", async () => {
    const ctx = createMockCtx();
    const host = createAddonHost(ctx);
    await host.updatePortfolio();
    await host.saveLastSynced();
    host.logError("bad");
    expect(ctx.api.portfolio.update).toHaveBeenCalled();
    expect(await ctx.api.storage.get("lunchmoney-addon:last-synced")).not.toBeNull();
    expect(ctx.api.logger.error).toHaveBeenCalledWith("bad");
  });
});
