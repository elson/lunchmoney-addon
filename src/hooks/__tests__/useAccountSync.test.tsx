import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAccountSync } from "../useAccountSync";
import { createMockCtx } from "../../test/mockCtx";
import type { LunchmoneyAccount } from "../../lib/lunchmoney";

vi.mock("../../lib/lunchmoney", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    fetchAllAccounts: vi.fn(),
  };
});

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

  it("sets status to no-api-key when no key is stored", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue(null);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.status.phase).toBe("no-api-key"));
  });

  it("loads accounts on mount when api key is present", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1), lm(2)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([wfAccount("w1")] as never);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.status.phase).toBe("ready"));

    expect(result.current.status.phase).toBe("ready");
    if (result.current.status.phase === "ready") {
      expect(result.current.status.vm.rows).toHaveLength(2);
    }
    expect(result.current.busy.refreshing).toBe(false);
  });

  it("sets error state when loadAll fails", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.error).toBe("Network error"));
    expect(result.current.busy.refreshing).toBe(false);
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
    await waitFor(() => expect(result.current.status.phase).toBe("ready"));

    const stored = localStorage.getItem("lunchmoney-addon:account-mapping");
    expect(stored).toBe(JSON.stringify({ 1: { type: "ignore" } }));
    if (result.current.status.phase === "ready") {
      expect(result.current.status.vm.isDirty).toBe(false);
    }
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
    await waitFor(() => expect(result.current.busy.refreshing).toBe(false));

    // setItem should not have been called for mapping key (only called on stale cleanup)
    const mappingCalls = setItemSpy.mock.calls.filter(([key]) => key.includes("account-mapping"));
    expect(mappingCalls).toHaveLength(0);
  });

  it("actions.changeDraft marks isDirty=true", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([] as never);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.busy.refreshing).toBe(false));

    act(() => {
      result.current.actions.changeDraft(1, { type: "create" });
    });

    expect(result.current.status.phase).toBe("ready");
    if (result.current.status.phase === "ready") {
      expect(result.current.status.vm.isDirty).toBe(true);
    }
  });

  it("actions.undo resets draft to savedMapping", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([] as never);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.busy.refreshing).toBe(false));

    act(() => {
      result.current.actions.changeDraft(1, { type: "create" });
    });
    if (result.current.status.phase === "ready") {
      expect(result.current.status.vm.isDirty).toBe(true);
    }

    act(() => {
      result.current.actions.undo();
    });
    if (result.current.status.phase === "ready") {
      expect(result.current.status.vm.isDirty).toBe(false);
    }
  });

  it("actions.confirm saves mapping (no create entries)", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([wfAccount("w1")] as never);
    localStorage.setItem(
      "lunchmoney-addon:account-mapping",
      JSON.stringify({ 1: { type: "existing", wfAccountId: "w1" } }),
    );

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.busy.refreshing).toBe(false));

    act(() => {
      result.current.actions.changeDraft(1, { type: "ignore" });
    });

    await act(async () => {
      await result.current.actions.confirm();
    });

    if (result.current.status.phase === "ready") {
      expect(result.current.status.vm.isDirty).toBe(false);
    }
    const stored = localStorage.getItem("lunchmoney-addon:account-mapping");
    expect(stored).toBe(JSON.stringify({ 1: { type: "ignore" } }));
  });

  it("actions.confirm creates wf accounts for create entries", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([] as never);
    vi.mocked(ctx.api.accounts.create).mockResolvedValue(wfAccount("new-1") as never);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.busy.refreshing).toBe(false));

    act(() => {
      result.current.actions.changeDraft(1, { type: "create" });
    });

    await act(async () => {
      await result.current.actions.confirm();
    });

    expect(ctx.api.accounts.create).toHaveBeenCalledTimes(1);
    const stored = JSON.parse(localStorage.getItem("lunchmoney-addon:account-mapping")!);
    expect(stored[1]).toEqual({ type: "existing", wfAccountId: "new-1" });
  });

  it("actions.confirm sets error on failure", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll)
      .mockResolvedValueOnce([] as never)
      .mockRejectedValueOnce(new Error("Save failed") as never);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.busy.refreshing).toBe(false));

    act(() => {
      result.current.actions.changeDraft(1, { type: "create" });
    });

    vi.mocked(ctx.api.accounts.create).mockRejectedValue(new Error("Save failed"));

    await act(async () => {
      await result.current.actions.confirm();
    });

    expect(result.current.error).toBe("Save failed");
  });

  it("actions.refresh reloads data when api key is set", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([] as never);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => {
      expect(result.current.status.phase).toBe("ready");
      if (result.current.status.phase === "ready") {
        expect(result.current.status.vm.rows).toHaveLength(1);
      }
    });

    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1), lm(2)]);
    act(() => {
      result.current.actions.refresh();
    });
    await waitFor(() => {
      if (result.current.status.phase === "ready") {
        expect(result.current.status.vm.rows).toHaveLength(2);
      }
    });
  });

  it("loadValuations populates wfCashBalances via VM", async () => {
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
    await waitFor(() => {
      if (result.current.status.phase === "ready") {
        const row = result.current.status.vm.rows.find((r) => r.wfAccount?.id === "w1");
        expect(row?.wfBalance).toBe(250.0);
      }
    });
  });

  it("actions.syncBalances is a no-op when status is no-api-key", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue(null);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.status.phase).toBe("no-api-key"));

    await act(async () => {
      await result.current.actions.syncBalances();
    });

    expect(ctx.api.snapshots.save).not.toHaveBeenCalled();
  });

  it("actions.syncBalances syncs all linked accounts", async () => {
    localStorage.setItem(
      "lunchmoney-addon:account-mapping",
      JSON.stringify({ 1: { type: "existing", wfAccountId: "w1" } }),
    );
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(fetchAllAccounts).mockResolvedValue([lm(1)]);
    vi.mocked(ctx.api.accounts.getAll).mockResolvedValue([wfAccount("w1")] as never);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.status.phase).toBe("ready"));

    await act(async () => {
      await result.current.actions.syncBalances();
    });

    expect(ctx.api.snapshots.save).toHaveBeenCalledTimes(1);
    expect(result.current.lastSynced).toBeInstanceOf(Date);
    expect(result.current.busy.syncing).toBe(false);
  });

  it("actions.syncBalances triggers portfolio update and refreshes balances on success", async () => {
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
    await waitFor(() => expect(result.current.status.phase).toBe("ready"));
    callOrder.length = 0; // reset after initial load

    await act(async () => {
      await result.current.actions.syncBalances();
    });

    expect(callOrder).toEqual(["snapshots.save", "portfolio.update", "getLatestValuations"]);
  });

  it("actions.syncBalances sets error on partial failure", async () => {
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
    await waitFor(() => expect(result.current.status.phase).toBe("ready"));

    await act(async () => {
      await result.current.actions.syncBalances();
    });

    expect(result.current.error).toContain("Snapshot failed");
    expect(result.current.busy.syncing).toBe(false);
  });
});
