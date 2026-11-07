import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAccountSync, deriveStatus } from "../useAccountSync";
import { createMockCtx } from "../../test/mockCtx";
import type { SyncEngine } from "../../lib/syncEngine";

// Mock the engine module — hook tests are React-only
vi.mock("../../lib/syncEngine", () => ({
  createSyncEngine: vi.fn(),
}));

import { createSyncEngine } from "../../lib/syncEngine";

function makeMockEngine(overrides: Partial<SyncEngine> = {}): SyncEngine {
  return {
    loadAll: vi.fn().mockResolvedValue({
      lmAccounts: [],
      wfAccounts: [],
      savedMapping: {},
      wfCashBalances: {},
    }),
    confirm: vi.fn().mockResolvedValue({ savedMapping: {}, wfAccounts: [] }),
    syncBalances: vi
      .fn()
      .mockResolvedValue({ ok: true, lastSynced: new Date(), wfCashBalances: {} }),
    ...overrides,
  };
}

function lmFixture(id: number, balance = "100.00") {
  return {
    id,
    name: `LM ${id}`,
    display_name: null,
    type: "cash",
    subtype: null,
    currency: "usd",
    balance,
    status: "active",
  };
}

function loaded(
  lmAccounts: ReturnType<typeof lmFixture>[],
  savedMapping: Record<number, unknown> = {},
  wfCashBalances: Record<string, number> = {},
) {
  return { lmAccounts, wfAccounts: [], savedMapping, wfCashBalances };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ─── deriveStatus ─────────────────────────────────────────────────────────────

describe("deriveStatus", () => {
  it("returns checking when apiKey is undefined", () => {
    expect(deriveStatus(undefined, false, null, null).phase).toBe("checking");
  });

  it("returns no-api-key when apiKey is null", () => {
    expect(deriveStatus(null, false, null, null).phase).toBe("no-api-key");
  });

  it("returns loading when loading=true", () => {
    expect(deriveStatus("key", true, null, null).phase).toBe("loading");
  });

  it("returns empty when lmAccounts is empty array", () => {
    expect(deriveStatus("key", false, [], null).phase).toBe("empty");
  });

  it("returns ready with vm when vm is set", () => {
    const vm = {} as never;
    const status = deriveStatus("key", false, [{ id: 1 } as never], vm);
    expect(status.phase).toBe("ready");
    if (status.phase === "ready") expect(status.vm).toBe(vm);
  });
});

// ─── useAccountSync ───────────────────────────────────────────────────────────

describe("useAccountSync", () => {
  it("does nothing when paused=true", async () => {
    const ctx = createMockCtx();
    const engine = makeMockEngine();
    vi.mocked(createSyncEngine).mockReturnValue(engine);

    renderHook(() => useAccountSync(ctx, true));
    await act(async () => {});

    expect(ctx.api.secrets.get).not.toHaveBeenCalled();
    expect(engine.loadAll).not.toHaveBeenCalled();
  });

  it("sets status to no-api-key when no key is stored", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue(null);
    vi.mocked(createSyncEngine).mockReturnValue(makeMockEngine());

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.status.phase).toBe("no-api-key"));
  });

  it("calls engine.loadAll and sets ready state when api key present", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    const engine = makeMockEngine({
      loadAll: vi.fn().mockResolvedValue({
        lmAccounts: [
          {
            id: 1,
            name: "LM 1",
            display_name: null,
            type: "cash",
            subtype: null,
            currency: "usd",
            balance: "100.00",
            status: "active",
          },
        ],
        wfAccounts: [],
        savedMapping: {},
        wfCashBalances: {},
      }),
    });
    vi.mocked(createSyncEngine).mockReturnValue(engine);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.status.phase).toBe("ready"));

    expect(engine.loadAll).toHaveBeenCalledTimes(1);
    expect(result.current.busy.syncing).toBe(false);
  });

  it("sets error state when engine.loadAll rejects", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(createSyncEngine).mockReturnValue(
      makeMockEngine({ loadAll: vi.fn().mockRejectedValue(new Error("Network error")) }),
    );

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.error).toBe("Network error"));
    expect(result.current.busy.syncing).toBe(false);
  });

  it("actions.changeDraft marks isDirty=true", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(createSyncEngine).mockReturnValue(
      makeMockEngine({
        loadAll: vi.fn().mockResolvedValue({
          lmAccounts: [
            {
              id: 1,
              name: "LM 1",
              display_name: null,
              type: "cash",
              subtype: null,
              currency: "usd",
              balance: "100.00",
              status: "active",
            },
          ],
          wfAccounts: [],
          savedMapping: {},
          wfCashBalances: {},
        }),
      }),
    );

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.status.phase).toBe("ready"));

    act(() => {
      result.current.actions.changeDraft(1, { type: "create" });
    });

    if (result.current.status.phase === "ready") {
      expect(result.current.status.vm.isDirty).toBe(true);
    }
  });

  it("actions.undo resets draft to savedMapping", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(createSyncEngine).mockReturnValue(
      makeMockEngine({
        loadAll: vi.fn().mockResolvedValue({
          lmAccounts: [
            {
              id: 1,
              name: "LM 1",
              display_name: null,
              type: "cash",
              subtype: null,
              currency: "usd",
              balance: "100.00",
              status: "active",
            },
          ],
          wfAccounts: [],
          savedMapping: {},
          wfCashBalances: {},
        }),
      }),
    );

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.status.phase).toBe("ready"));

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

  it("actions.confirm delegates to engine and updates state", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    const engine = makeMockEngine({
      loadAll: vi.fn().mockResolvedValue({
        lmAccounts: [
          {
            id: 1,
            name: "LM 1",
            display_name: null,
            type: "cash",
            subtype: null,
            currency: "usd",
            balance: "100.00",
            status: "active",
          },
        ],
        wfAccounts: [],
        savedMapping: {},
        wfCashBalances: {},
      }),
      confirm: vi.fn().mockResolvedValue({
        savedMapping: { 1: { type: "ignore" } },
        wfAccounts: [],
      }),
    });
    vi.mocked(createSyncEngine).mockReturnValue(engine);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.status.phase).toBe("ready"));

    act(() => {
      result.current.actions.changeDraft(1, { type: "ignore" });
    });

    await act(async () => {
      await result.current.actions.confirm();
    });

    expect(engine.confirm).toHaveBeenCalled();
    if (result.current.status.phase === "ready") {
      expect(result.current.status.vm.isDirty).toBe(false);
    }
  });

  it("actions.confirm sets error when engine rejects", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(createSyncEngine).mockReturnValue(
      makeMockEngine({
        loadAll: vi.fn().mockResolvedValue({
          lmAccounts: [
            {
              id: 1,
              name: "LM 1",
              display_name: null,
              type: "cash",
              subtype: null,
              currency: "usd",
              balance: "100.00",
              status: "active",
            },
          ],
          wfAccounts: [],
          savedMapping: {},
          wfCashBalances: {},
        }),
        confirm: vi.fn().mockRejectedValue(new Error("Save failed")),
      }),
    );

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.status.phase).toBe("ready"));

    await act(async () => {
      await result.current.actions.confirm();
    });

    expect(result.current.error).toBe("Save failed");
    expect(result.current.busy.saving).toBe(false);
  });

  it("actions.sync re-fetches from Lunch Money, then imports balances that differ", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    const saved = { 1: { type: "existing" as const, wfAccountId: "w1" } };
    const loadAll = vi
      .fn()
      .mockResolvedValueOnce(loaded([lmFixture(1)], saved))
      .mockResolvedValue(loaded([lmFixture(1, "150.00"), lmFixture(2)], saved, { w1: 100 }));
    const synced = new Date();
    const syncBalances = vi.fn().mockResolvedValue({
      ok: true,
      lastSynced: synced,
      wfCashBalances: { w1: 150 },
      imported: 1,
    });
    vi.mocked(createSyncEngine).mockReturnValue(makeMockEngine({ loadAll, syncBalances }));

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.status.phase).toBe("ready"));

    await act(async () => {
      await result.current.actions.sync();
    });

    expect(loadAll).toHaveBeenCalledTimes(2);
    expect(syncBalances).toHaveBeenCalledWith(saved, [lmFixture(1, "150.00"), lmFixture(2)], {
      w1: 100,
    });
    expect(result.current.lastSynced).toBe(synced);
    expect(result.current.lastSyncResult).toEqual({ imported: 1 });
    expect(result.current.busy.syncing).toBe(false);
    if (result.current.status.phase === "ready") {
      expect(result.current.status.vm.rows).toHaveLength(2);
    }
  });

  it("actions.sync keeps the table on screen while it runs", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    let resolveSecond!: (v: unknown) => void;
    const loadAll = vi
      .fn()
      .mockResolvedValueOnce(loaded([lmFixture(1)]))
      .mockImplementation(() => new Promise((r) => (resolveSecond = r)));
    vi.mocked(createSyncEngine).mockReturnValue(makeMockEngine({ loadAll }));

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.status.phase).toBe("ready"));

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.actions.sync();
    });
    expect(result.current.busy.syncing).toBe(true);
    expect(result.current.status.phase).toBe("ready");
    await act(async () => {
      resolveSecond(loaded([lmFixture(1)]));
      await pending;
    });
  });

  it("actions.sync only refreshes when nothing is linked", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    const engine = makeMockEngine({ loadAll: vi.fn().mockResolvedValue(loaded([lmFixture(1)])) });
    vi.mocked(createSyncEngine).mockReturnValue(engine);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.status.phase).toBe("ready"));
    await act(async () => {
      await result.current.actions.sync();
    });

    expect(engine.loadAll).toHaveBeenCalledTimes(2);
    expect(engine.syncBalances).not.toHaveBeenCalled();
  });

  it("actions.sync is a no-op without an API key", async () => {
    const ctx = createMockCtx();
    const engine = makeMockEngine();
    vi.mocked(createSyncEngine).mockReturnValue(engine);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.status.phase).toBe("no-api-key"));
    await act(async () => {
      await result.current.actions.sync();
    });

    expect(engine.loadAll).not.toHaveBeenCalled();
  });

  it("actions.sync reports import errors", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(createSyncEngine).mockReturnValue(
      makeMockEngine({
        loadAll: vi
          .fn()
          .mockResolvedValue(
            loaded([lmFixture(1)], { 1: { type: "existing", wfAccountId: "w1" } }),
          ),
        syncBalances: vi.fn().mockResolvedValue({ ok: false, errors: ["Snapshot failed"] }),
      }),
    );

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.status.phase).toBe("ready"));
    await act(async () => {
      await result.current.actions.sync();
    });

    expect(result.current.error).toContain("Snapshot failed");
    expect(result.current.busy.syncing).toBe(false);
  });

  it("actions.sync reports a failed refresh", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(createSyncEngine).mockReturnValue(
      makeMockEngine({
        loadAll: vi
          .fn()
          .mockResolvedValueOnce(loaded([lmFixture(1)]))
          .mockRejectedValue(new Error("offline")),
      }),
    );

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.status.phase).toBe("ready"));
    await act(async () => {
      await result.current.actions.sync();
    });

    expect(result.current.error).toBe("offline");
    expect(result.current.status.phase).toBe("ready");
  });

  it("actions.confirm can import balances straight after saving the links", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    const saved = { 1: { type: "existing" as const, wfAccountId: "w1" } };
    const engine = makeMockEngine({
      loadAll: vi.fn().mockResolvedValue(loaded([lmFixture(1)], {}, { w1: 50 })),
      confirm: vi.fn().mockResolvedValue({ savedMapping: saved, wfAccounts: [] }),
      syncBalances: vi.fn().mockResolvedValue({
        ok: true,
        lastSynced: new Date(),
        wfCashBalances: { w1: 100 },
        imported: 1,
      }),
    });
    vi.mocked(createSyncEngine).mockReturnValue(engine);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.status.phase).toBe("ready"));
    await act(async () => {
      await result.current.actions.confirm({ importBalances: true });
    });

    expect(engine.syncBalances).toHaveBeenCalledWith(saved, [lmFixture(1)], { w1: 50 });
    expect(result.current.lastSyncResult).toEqual({ imported: 1 });
  });
});

describe("useAccountSync lastSynced", () => {
  it("loads the persisted last-synced time from addon storage", async () => {
    const ctx = createMockCtx();
    await ctx.api.storage.set("lunchmoney-addon:last-synced", "1700000000000");
    vi.mocked(createSyncEngine).mockReturnValue(makeMockEngine());

    const { result } = renderHook(() => useAccountSync(ctx, false));

    await waitFor(() => expect(result.current.lastSynced?.getTime()).toBe(1_700_000_000_000));
  });
});
