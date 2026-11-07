import { describe, expect, it, vi } from "vitest";
import { importChangedBalances, runBalanceSync, type BalanceSyncHost } from "../balanceSync";
import type { LunchmoneyAccount } from "../lunchmoney";
import type { AccountMapping } from "../../types";

const lm = (id: number, balance = "100.00", currency = "usd"): LunchmoneyAccount => ({
  id,
  name: `LM ${id}`,
  display_name: null,
  type: "cash",
  subtype: null,
  currency,
  balance,
  status: "active",
});

function fakeHost(overrides: Partial<BalanceSyncHost> = {}): BalanceSyncHost {
  return {
    fetchLunchMoneyAccounts: vi.fn().mockResolvedValue([]),
    loadMapping: vi.fn().mockResolvedValue({}),
    listWealthfolioAccountIds: vi.fn().mockResolvedValue([]),
    latestCashBalances: vi.fn().mockResolvedValue({}),
    saveCashSnapshot: vi.fn().mockResolvedValue(undefined),
    updatePortfolio: vi.fn().mockResolvedValue(undefined),
    saveLastSynced: vi.fn().mockResolvedValue(undefined),
    logError: vi.fn(),
    ...overrides,
  };
}

const TODAY = "2026-11-07";

describe("importChangedBalances", () => {
  it("saves a cash snapshot in the account's currency for each balance that differs", async () => {
    const host = fakeHost();
    const mapping: AccountMapping = {
      1: { type: "existing", wfAccountId: "w1" },
      2: { type: "existing", wfAccountId: "w2" },
      3: { type: "existing", wfAccountId: "w3" },
      4: { type: "ignore" },
      5: { type: "create" },
    };

    const result = await importChangedBalances(
      host,
      mapping,
      [lm(1), lm(2, "50.25", "gbp"), lm(3), lm(4), lm(5)],
      { w1: 100, w2: 90 },
      TODAY,
    );

    expect(vi.mocked(host.saveCashSnapshot).mock.calls).toEqual([
      ["w2", "GBP", "50.25", TODAY],
      ["w3", "USD", "100.00", TODAY],
    ]);
    expect(result).toEqual({ imported: 2, errors: [] });
  });

  it("records the sync time, then updates the portfolio when anything was imported", async () => {
    const order: string[] = [];
    const host = fakeHost({
      saveCashSnapshot: vi.fn(async () => void order.push("snapshot")),
      saveLastSynced: vi.fn(async () => void order.push("lastSynced")),
      updatePortfolio: vi.fn(async () => void order.push("update")),
    });

    await importChangedBalances(
      host,
      { 1: { type: "existing", wfAccountId: "w1" } },
      [lm(1)],
      {},
      TODAY,
    );

    expect(order).toEqual(["snapshot", "lastSynced", "update"]);
  });

  it("records the sync time without updating the portfolio when every balance matches", async () => {
    const host = fakeHost();

    const result = await importChangedBalances(
      host,
      { 1: { type: "existing", wfAccountId: "w1" } },
      [lm(1)],
      { w1: 100 },
      TODAY,
    );

    expect(result).toEqual({ imported: 0, errors: [] });
    expect(host.saveLastSynced).toHaveBeenCalled();
    expect(host.updatePortfolio).not.toHaveBeenCalled();
  });

  it("collects and logs failures, and then neither records the sync nor updates the portfolio", async () => {
    const host = fakeHost({ saveCashSnapshot: vi.fn().mockRejectedValue(new Error("boom")) });

    const result = await importChangedBalances(
      host,
      { 1: { type: "existing", wfAccountId: "w1" } },
      [lm(1)],
      {},
      TODAY,
    );

    expect(result).toEqual({ imported: 0, errors: ["boom"] });
    expect(host.logError).toHaveBeenCalledWith(
      expect.stringContaining("Balance sync failed for LM account 1"),
    );
    expect(host.saveLastSynced).not.toHaveBeenCalled();
    expect(host.updatePortfolio).not.toHaveBeenCalled();
  });

  it("reports a failure that isn't an Error by its text", async () => {
    const host = fakeHost({ saveCashSnapshot: vi.fn().mockRejectedValue("nope") });
    const result = await importChangedBalances(
      host,
      { 1: { type: "existing", wfAccountId: "w1" } },
      [lm(1)],
      {},
      TODAY,
    );
    expect(result.errors).toEqual(["nope"]);
  });
});

describe("runBalanceSync", () => {
  it("does nothing, not even calling Lunch Money, when no account is linked", async () => {
    const host = fakeHost({ loadMapping: vi.fn().mockResolvedValue({ 1: { type: "ignore" } }) });

    expect(await runBalanceSync(host, TODAY)).toEqual({ status: "nothing-linked" });
    expect(host.fetchLunchMoneyAccounts).not.toHaveBeenCalled();
    expect(host.saveLastSynced).not.toHaveBeenCalled();
  });

  it("imports the linked balances that differ from Wealthfolio's latest valuations", async () => {
    const host = fakeHost({
      loadMapping: vi.fn().mockResolvedValue({
        1: { type: "existing", wfAccountId: "w1" },
        2: { type: "existing", wfAccountId: "w2" },
      }),
      fetchLunchMoneyAccounts: vi.fn().mockResolvedValue([lm(1), lm(2, "75.00")]),
      listWealthfolioAccountIds: vi.fn().mockResolvedValue(["w1", "w2"]),
      latestCashBalances: vi.fn().mockResolvedValue({ w1: 100, w2: 70 }),
    });

    const outcome = await runBalanceSync(host, TODAY);

    expect(host.latestCashBalances).toHaveBeenCalledWith(["w1", "w2"]);
    expect(vi.mocked(host.saveCashSnapshot).mock.calls).toEqual([["w2", "USD", "75.00", TODAY]]);
    expect(outcome).toEqual({ status: "synced", checked: 2, imported: 1 });
  });

  it("skips links to Wealthfolio accounts that no longer exist", async () => {
    const host = fakeHost({
      loadMapping: vi.fn().mockResolvedValue({
        1: { type: "existing", wfAccountId: "gone" },
        2: { type: "existing", wfAccountId: "w2" },
      }),
      fetchLunchMoneyAccounts: vi.fn().mockResolvedValue([lm(1), lm(2)]),
      listWealthfolioAccountIds: vi.fn().mockResolvedValue(["w2"]),
    });

    const outcome = await runBalanceSync(host, TODAY);

    expect(host.latestCashBalances).toHaveBeenCalledWith(["w2"]);
    expect(vi.mocked(host.saveCashSnapshot).mock.calls.map(([id]) => id)).toEqual(["w2"]);
    expect(outcome).toEqual({ status: "synced", checked: 1, imported: 1 });
  });

  it("fails rather than recording a sync when Lunch Money returns none of the linked accounts", async () => {
    const host = fakeHost({
      loadMapping: vi.fn().mockResolvedValue({ 1: { type: "existing", wfAccountId: "w1" } }),
      listWealthfolioAccountIds: vi.fn().mockResolvedValue(["w1"]),
      fetchLunchMoneyAccounts: vi.fn().mockResolvedValue([]),
    });

    const outcome = await runBalanceSync(host, TODAY);

    expect(outcome).toEqual({
      status: "failed",
      errors: ["Lunch Money returned none of the linked accounts"],
    });
    expect(host.saveLastSynced).not.toHaveBeenCalled();
  });

  it("returns the snapshot errors when an import fails", async () => {
    const host = fakeHost({
      loadMapping: vi.fn().mockResolvedValue({ 1: { type: "existing", wfAccountId: "w1" } }),
      listWealthfolioAccountIds: vi.fn().mockResolvedValue(["w1"]),
      fetchLunchMoneyAccounts: vi.fn().mockResolvedValue([lm(1)]),
      saveCashSnapshot: vi.fn().mockRejectedValue(new Error("locked")),
    });

    expect(await runBalanceSync(host, TODAY)).toEqual({ status: "failed", errors: ["locked"] });
  });
});
