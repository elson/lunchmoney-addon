import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  serializeMapping,
  deserializeMapping,
  mappingsEqual,
  cleanMapping,
  claimedWfIds,
  loadMapping,
  saveMapping,
  loadLastSynced,
  saveLastSynced,
} from "../mapping";
import { createMockCtx } from "../../test/mockCtx";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// ─── serializeMapping / deserializeMapping ────────────────────────────────────

describe("serializeMapping", () => {
  it("round-trips a mapping", () => {
    const m = {
      1: { type: "existing" as const, wfAccountId: "w1" },
      2: { type: "ignore" as const },
    };
    expect(deserializeMapping(serializeMapping(m))).toEqual(m);
  });
});

describe("deserializeMapping", () => {
  it("returns {} for null", () => {
    expect(deserializeMapping(null)).toEqual({});
  });

  it("returns {} for invalid JSON", () => {
    expect(deserializeMapping("not json {")).toEqual({});
  });
});

// ─── mappingsEqual ────────────────────────────────────────────────────────────

describe("mappingsEqual", () => {
  it("returns true for identical mappings", () => {
    const m = { 1: { type: "existing" as const, wfAccountId: "w1" } };
    expect(mappingsEqual(m, m)).toBe(true);
  });

  it("returns false when key counts differ", () => {
    const a = { 1: { type: "ignore" as const } };
    const b = { 1: { type: "ignore" as const }, 2: { type: "ignore" as const } };
    expect(mappingsEqual(a, b)).toBe(false);
  });

  it("returns false when types differ", () => {
    const a = { 1: { type: "ignore" as const } };
    const b = { 1: { type: "create" as const } };
    expect(mappingsEqual(a, b)).toBe(false);
  });

  it("returns false when wfAccountId differs", () => {
    const a = { 1: { type: "existing" as const, wfAccountId: "w1" } };
    const b = { 1: { type: "existing" as const, wfAccountId: "w2" } };
    expect(mappingsEqual(a, b)).toBe(false);
  });

  it("returns false when a key is missing from b", () => {
    const a = { 1: { type: "ignore" as const } };
    const b = { 2: { type: "ignore" as const } };
    expect(mappingsEqual(a, b)).toBe(false);
  });
});

// ─── cleanMapping ─────────────────────────────────────────────────────────────

describe("cleanMapping", () => {
  it("drops entries for deleted LM ids", () => {
    const mapping = { 1: { type: "ignore" as const }, 2: { type: "ignore" as const } };
    const result = cleanMapping(mapping, new Set(), new Set([1]));
    expect(result).toEqual({ 1: { type: "ignore" } });
  });

  it("downgrades existing entry when WF id is invalid", () => {
    const mapping = { 1: { type: "existing" as const, wfAccountId: "gone" } };
    const result = cleanMapping(mapping, new Set(), new Set([1]));
    expect(result).toEqual({ 1: { type: "ignore" } });
  });

  it("preserves valid existing entries", () => {
    const mapping = { 1: { type: "existing" as const, wfAccountId: "w1" } };
    const result = cleanMapping(mapping, new Set(["w1"]), new Set([1]));
    expect(result).toEqual({ 1: { type: "existing", wfAccountId: "w1" } });
  });

  it("preserves ignore/create entries for valid LM ids", () => {
    const mapping = { 1: { type: "ignore" as const }, 2: { type: "create" as const } };
    const result = cleanMapping(mapping, new Set(), new Set([1, 2]));
    expect(result).toEqual({ 1: { type: "ignore" }, 2: { type: "create" } });
  });
});

// ─── claimedWfIds ─────────────────────────────────────────────────────────────

describe("claimedWfIds", () => {
  it("returns empty set for empty mapping", () => {
    expect(claimedWfIds({})).toEqual(new Set());
  });

  it("ignores non-existing entries", () => {
    const draft = { 1: { type: "ignore" as const }, 2: { type: "create" as const } };
    expect(claimedWfIds(draft)).toEqual(new Set());
  });

  it("returns wfAccountIds for existing entries", () => {
    const draft = {
      1: { type: "existing" as const, wfAccountId: "w1" },
      2: { type: "existing" as const, wfAccountId: "w2" },
      3: { type: "ignore" as const },
    };
    expect(claimedWfIds(draft)).toEqual(new Set(["w1", "w2"]));
  });
});

// ─── loadMapping ──────────────────────────────────────────────────────────────

describe("loadMapping", () => {
  it("returns mapping from localStorage when present", async () => {
    const m = { 1: { type: "ignore" as const } };
    localStorage.setItem("lunchmoney-addon:account-mapping", JSON.stringify(m));
    const ctx = createMockCtx();
    const result = await loadMapping(ctx);
    expect(result).toEqual(m);
    expect(ctx.api.secrets.get).not.toHaveBeenCalled();
  });

  it("migrates from secrets when localStorage is empty", async () => {
    const m = { 5: { type: "create" as const } };
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValueOnce(JSON.stringify(m));
    const result = await loadMapping(ctx);
    expect(result).toEqual(m);
    expect(localStorage.getItem("lunchmoney-addon:account-mapping")).toBe(JSON.stringify(m));
    expect(ctx.api.secrets.delete).toHaveBeenCalled();
  });

  it("returns empty mapping when both sources are empty", async () => {
    const ctx = createMockCtx();
    const result = await loadMapping(ctx);
    expect(result).toEqual({});
  });
});

// ─── saveMapping ──────────────────────────────────────────────────────────────

describe("saveMapping", () => {
  it("writes serialized mapping to localStorage", () => {
    const m = { 3: { type: "existing" as const, wfAccountId: "w3" } };
    saveMapping(m);
    expect(localStorage.getItem("lunchmoney-addon:account-mapping")).toBe(JSON.stringify(m));
  });
});

// ─── loadLastSynced / saveLastSynced ──────────────────────────────────────────

describe("loadLastSynced", () => {
  it("returns null when key is absent", () => {
    expect(loadLastSynced()).toBeNull();
  });

  it("returns null for NaN timestamp", () => {
    localStorage.setItem("lunchmoney-addon:last-synced", "not-a-number");
    expect(loadLastSynced()).toBeNull();
  });

  it("returns a Date for a valid timestamp", () => {
    const ts = 1_700_000_000_000;
    localStorage.setItem("lunchmoney-addon:last-synced", String(ts));
    const result = loadLastSynced();
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(ts);
  });
});

describe("saveLastSynced", () => {
  it("writes a numeric timestamp to localStorage", () => {
    const before = Date.now();
    saveLastSynced();
    const after = Date.now();
    const stored = Number(localStorage.getItem("lunchmoney-addon:last-synced"));
    expect(stored).toBeGreaterThanOrEqual(before);
    expect(stored).toBeLessThanOrEqual(after);
  });
});
