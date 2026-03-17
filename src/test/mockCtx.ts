import { vi } from "vitest";
import type { AddonContext } from "@wealthfolio/addon-sdk";

export function createMockCtx(): AddonContext {
  return {
    sidebar: {
      addItem: vi.fn().mockReturnValue({ remove: vi.fn() }),
    },
    router: {
      add: vi.fn(),
    },
    onDisable: vi.fn(),
    api: {
      secrets: {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      },
      accounts: {
        getAll: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({
          id: "wf-1",
          name: "Mock Account",
          accountType: "CASH",
          currency: "USD",
          isDefault: false,
          isActive: true,
          trackingMode: "HOLDINGS",
        }),
      },
      portfolio: {
        getLatestValuations: vi.fn().mockResolvedValue([]),
        getHoldings: vi.fn().mockResolvedValue([]),
        getHolding: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue(undefined),
        recalculate: vi.fn().mockResolvedValue(undefined),
        getHistoricalValuations: vi.fn().mockResolvedValue([]),
        getIncomeSummary: vi.fn().mockResolvedValue([]),
      },
      snapshots: {
        save: vi.fn().mockResolvedValue(undefined),
      },
      activities: {
        getAll: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({}),
        saveMany: vi.fn().mockResolvedValue([]),
        import: vi.fn().mockResolvedValue([]),
        checkImport: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
      },
      assets: {
        getAll: vi.fn().mockResolvedValue([]),
        search: vi.fn().mockResolvedValue([]),
      },
      market: {
        getAll: vi.fn().mockResolvedValue([]),
      },
      quotes: {
        getLatest: vi.fn().mockResolvedValue([]),
      },
      performance: {
        get: vi.fn().mockResolvedValue({}),
      },
      exchangeRates: {
        getAll: vi.fn().mockResolvedValue([]),
      },
      goals: {
        getAll: vi.fn().mockResolvedValue([]),
      },
      contributionLimits: {
        getAll: vi.fn().mockResolvedValue([]),
      },
      settings: {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
      },
      files: {
        openCsvDialog: vi.fn().mockResolvedValue(null),
        openSaveDialog: vi.fn().mockResolvedValue(undefined),
      },
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
      },
      query: {
        getClient: vi.fn(),
        invalidateQueries: vi.fn(),
        refetchQueries: vi.fn(),
      },
      events: {
        navigate: vi.fn(),
        onUpdateComplete: vi.fn().mockResolvedValue(vi.fn()),
        onSyncComplete: vi.fn().mockResolvedValue(vi.fn()),
        onDrop: vi.fn().mockResolvedValue(vi.fn()),
      },
      navigation: {
        navigate: vi.fn(),
      },
    },
  } as unknown as AddonContext;
}
