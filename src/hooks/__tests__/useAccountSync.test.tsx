import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAccountSync } from "../useAccountSync";
import { createMockCtx } from "../../test/mockCtx";
import type { LunchmoneyAccount } from "../../lib/lunchmoney";

vi.mock("../../lib/lunchmoney", () => ({
  fetchAllAccounts: vi.fn(),
}));

import { fetchAllAccounts } from "../../lib/lunchmoney";

const lm = (id: number): LunchmoneyAccount => ({
  id,
  name: `LM ${id}`,
  display_name: null,
  type: "cash",
  subtype: null,
  currency: "usd",
  balance: "100.00",
  status: "active",
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

describe("useAccountSync", () => {
  it("does nothing when paused=true", async () => {
    const ctx = createMockCtx();
    renderHook(() => useAccountSync(ctx, true));
    await act(async () => {});
    expect(ctx.api.secrets.get).not.toHaveBeenCalled();
  });

  it("sets hasApiKey=false when no key is stored", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue(null);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.hasApiKey).toBe(false));
    expect(result.current.lmAccounts).toBeNull();
  });

  it("loads accounts on mount when api key is present", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1), lm(2)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([wfAccount("w1")] as never);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.lmAccounts).toHaveLength(2));

    expect(result.current.hasApiKey).toBe(true);
    expect(result.current.wfAccounts).toHaveLength(1);
    expect(result.current.loading).toBe(false);
  });

  it("sets error state when loadAll fails", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.error).toBe("Network error"));
    expect(result.current.loading).toBe(false);
  });

  it("auto-saves cleaned mapping when a deleted LM account is removed", async () => {
    // LM ids 1 and 2 in saved mapping, but only id 1 is returned by the API
    localStorage.setItem(
      "lunchmoney-addon:account-mapping",
      JSON.stringify({
        1: { type: "ignore" },
        2: { type: "ignore" }, // id 2 deleted from LM
      }),
    );
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]); // only id 1 returned
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([] as never);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.lmAccounts).toHaveLength(1));

    const stored = localStorage.getItem("lunchmoney-addon:account-mapping");
    expect(stored).toBe(JSON.stringify({ 1: { type: "ignore" } }));
    expect(result.current.isDirty).toBe(false);
  });

  it("does not auto-save when no stale entries", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([wfAccount("w1")] as never);
    localStorage.setItem(
      "lunchmoney-addon:account-mapping",
      JSON.stringify({ 1: { type: "existing", wfAccountId: "w1" } }),
    );

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // setItem should not have been called for mapping key (only called on stale cleanup)
    const mappingCalls = setItemSpy.mock.calls.filter(([key]) => key.includes("account-mapping"));
    expect(mappingCalls).toHaveLength(0);
  });

  it("handleDraftChange marks isDirty=true", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([] as never);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.handleDraftChange(1, { type: "create" });
    });

    expect(result.current.isDirty).toBe(true);
  });

  it("handleUndo resets draft to savedMapping", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([] as never);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.handleDraftChange(1, { type: "create" });
    });
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.handleUndo();
    });
    expect(result.current.isDirty).toBe(false);
  });

  it("handleConfirm saves mapping (no create entries)", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([wfAccount("w1")] as never);
    localStorage.setItem(
      "lunchmoney-addon:account-mapping",
      JSON.stringify({ 1: { type: "existing", wfAccountId: "w1" } }),
    );

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.handleDraftChange(1, { type: "ignore" });
    });

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(result.current.isDirty).toBe(false);
    const stored = localStorage.getItem("lunchmoney-addon:account-mapping");
    expect(stored).toBe(JSON.stringify({ 1: { type: "ignore" } }));
  });

  it("handleConfirm creates wf accounts for create entries", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([] as never);
    vi.mocked(ctx.api.accounts.create).mockResolvedValue(wfAccount("new-1") as never);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.handleDraftChange(1, { type: "create" });
    });

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(ctx.api.accounts.create).toHaveBeenCalledTimes(1);
    const stored = JSON.parse(localStorage.getItem("lunchmoney-addon:account-mapping")!);
    expect(stored[1]).toEqual({ type: "existing", wfAccountId: "new-1" });
  });

  it("handleConfirm sets error on failure", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll)
      .mockResolvedValueOnce([] as never)
      .mockRejectedValueOnce(new Error("Save failed") as never);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.handleDraftChange(1, { type: "create" });
    });

    vi.mocked(ctx.api.accounts.create).mockRejectedValue(new Error("Save failed"));

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(result.current.error).toBe("Save failed");
  });

  it("handleRefresh reloads data when api key is set", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([] as never);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.lmAccounts).toHaveLength(1));

    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1), lm(2)]);
    act(() => {
      result.current.handleRefresh();
    });
    await waitFor(() => expect(result.current.lmAccounts).toHaveLength(2));
  });

  it("loadValuations populates wfCashBalances", async () => {
    localStorage.setItem(
      "lunchmoney-addon:account-mapping",
      JSON.stringify({ 1: { type: "existing", wfAccountId: "w1" } }),
    );
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([wfAccount("w1")] as never);
    vi.mocked(ctx.api.portfolio.getLatestValuations).mockResolvedValue([
      { accountId: "w1", cashBalance: 250.0 } as never,
    ]);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.wfCashBalances["w1"]).toBe(250.0));
  });

  it("handleSyncBalances is a no-op when lmAccounts is null", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue(null);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.hasApiKey).toBe(false));

    await act(async () => {
      await result.current.handleSyncBalances();
    });

    expect(ctx.api.snapshots.save).not.toHaveBeenCalled();
  });

  it("handleSyncBalances syncs all linked accounts", async () => {
    localStorage.setItem(
      "lunchmoney-addon:account-mapping",
      JSON.stringify({ 1: { type: "existing", wfAccountId: "w1" } }),
    );
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([wfAccount("w1")] as never);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.lmAccounts).toHaveLength(1));

    await act(async () => {
      await result.current.handleSyncBalances();
    });

    expect(ctx.api.snapshots.save).toHaveBeenCalledTimes(1);
    expect(result.current.lastSynced).toBeInstanceOf(Date);
    expect(result.current.isSyncingBalances).toBe(false);
  });

  it("handleSyncBalances triggers portfolio update and refreshes balances on success", async () => {
    localStorage.setItem(
      "lunchmoney-addon:account-mapping",
      JSON.stringify({ 1: { type: "existing", wfAccountId: "w1" } }),
    );
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([wfAccount("w1")] as never);
    vi.mocked(ctx.api.portfolio.getLatestValuations).mockResolvedValue([
      { accountId: "w1", cashBalance: 100.0 } as never,
    ]);

    const callOrder: string[] = [];
    vi.mocked(ctx.api.snapshots.save).mockImplementation(async () => {
      callOrder.push("snapshots.save");
    });
    vi.mocked(ctx.api.portfolio.update).mockImplementation(async () => {
      callOrder.push("portfolio.update");
    });
    vi.mocked(ctx.api.portfolio.getLatestValuations).mockImplementation(async () => {
      callOrder.push("getLatestValuations");
      return [{ accountId: "w1", cashBalance: 100.0 }] as never;
    });

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.lmAccounts).toHaveLength(1));
    callOrder.length = 0; // reset after initial load

    await act(async () => {
      await result.current.handleSyncBalances();
    });

    expect(callOrder).toEqual(["snapshots.save", "portfolio.update", "getLatestValuations"]);
    expect(result.current.wfCashBalances["w1"]).toBe(100.0);
  });

  it("handleSyncBalances sets error on partial failure", async () => {
    localStorage.setItem(
      "lunchmoney-addon:account-mapping",
      JSON.stringify({ 1: { type: "existing", wfAccountId: "w1" } }),
    );
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([wfAccount("w1")] as never);
    vi.mocked(ctx.api.snapshots.save).mockRejectedValue(new Error("Snapshot failed"));

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.lmAccounts).toHaveLength(1));

    await act(async () => {
      await result.current.handleSyncBalances();
    });

    expect(result.current.error).toContain("Snapshot failed");
    expect(result.current.isSyncingBalances).toBe(false);
  });
});
