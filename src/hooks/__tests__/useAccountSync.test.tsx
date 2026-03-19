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

beforeEach(() => {
  localStorage.clear();
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

    expect(engine.loadAll).toHaveBeenCalledWith("test-key");
    expect(result.current.busy.refreshing).toBe(false);
  });

  it("sets error state when engine.loadAll rejects", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    vi.mocked(createSyncEngine).mockReturnValue(
      makeMockEngine({ loadAll: vi.fn().mockRejectedValue(new Error("Network error")) }),
    );

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.error).toBe("Network error"));
    expect(result.current.busy.refreshing).toBe(false);
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

  it("actions.refresh calls engine.loadAll again", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    const loadAll = vi
      .fn()
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValue({
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
          {
            id: 2,
            name: "LM 2",
            display_name: null,
            type: "cash",
            subtype: null,
            currency: "usd",
            balance: "200.00",
            status: "active",
          },
        ],
        wfAccounts: [],
        savedMapping: {},
        wfCashBalances: {},
      });
    vi.mocked(createSyncEngine).mockReturnValue(makeMockEngine({ loadAll }));

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => {
      expect(result.current.status.phase).toBe("ready");
      if (result.current.status.phase === "ready") {
        expect(result.current.status.vm.rows).toHaveLength(1);
      }
    });

    act(() => {
      result.current.actions.refresh();
    });
    await waitFor(() => {
      if (result.current.status.phase === "ready") {
        expect(result.current.status.vm.rows).toHaveLength(2);
      }
    });
  });

  it("actions.syncBalances is a no-op when lmAccounts not loaded", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue(null);
    const engine = makeMockEngine();
    vi.mocked(createSyncEngine).mockReturnValue(engine);

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.status.phase).toBe("no-api-key"));

    await act(async () => {
      await result.current.actions.syncBalances();
    });

    expect(engine.syncBalances).not.toHaveBeenCalled();
  });

  it("actions.syncBalances sets error when engine returns ok:false", async () => {
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
          savedMapping: { 1: { type: "existing", wfAccountId: "w1" } },
          wfCashBalances: {},
        }),
        syncBalances: vi.fn().mockResolvedValue({ ok: false, errors: ["Snapshot failed"] }),
      }),
    );

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.status.phase).toBe("ready"));

    await act(async () => {
      await result.current.actions.syncBalances();
    });

    expect(result.current.error).toContain("Snapshot failed");
    expect(result.current.busy.syncing).toBe(false);
  });

  it("actions.syncBalances updates lastSynced and wfCashBalances on success", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("test-key");
    const newDate = new Date();
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
          savedMapping: { 1: { type: "existing", wfAccountId: "w1" } },
          wfCashBalances: {},
        }),
        syncBalances: vi.fn().mockResolvedValue({
          ok: true,
          lastSynced: newDate,
          wfCashBalances: { w1: 100.0 },
        }),
      }),
    );

    const { result } = renderHook(() => useAccountSync(ctx, false));
    await waitFor(() => expect(result.current.status.phase).toBe("ready"));

    await act(async () => {
      await result.current.actions.syncBalances();
    });

    expect(result.current.lastSynced).toBe(newDate);
    expect(result.current.busy.syncing).toBe(false);
  });
});
