import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  serializeMapping,
  deserializeMapping,
  mappingsEqual,
  cleanMapping,
  loadMapping,
  saveMapping,
  loadLastSynced,
  saveLastSynced,
} from "../mapping";
import { createMockCtx } from "../../test/mockCtx";

const MAPPING_KEY = "lunchmoney-addon:account-mapping";
const LAST_SYNCED_KEY = "lunchmoney-addon:last-synced";

beforeEach(() => {
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

// ─── loadMapping ──────────────────────────────────────────────────────────────

describe("loadMapping", () => {
  it("returns mapping from addon storage when present", async () => {
    const m = { 1: { type: "ignore" as const } };
    const ctx = createMockCtx();
    await ctx.api.storage.set(MAPPING_KEY, JSON.stringify(m));
    const result = await loadMapping(ctx);
    expect(result).toEqual(m);
    expect(ctx.api.secrets.get).not.toHaveBeenCalled();
  });

  it("migrates from legacy secret when storage is empty", async () => {
    const m = { 5: { type: "create" as const } };
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValueOnce(JSON.stringify(m));
    const result = await loadMapping(ctx);
    expect(result).toEqual(m);
    expect(await ctx.api.storage.get(MAPPING_KEY)).toBe(JSON.stringify(m));
    expect(ctx.api.secrets.delete).toHaveBeenCalledWith("account-mapping");
  });

  it("returns empty mapping when both sources are empty", async () => {
    const ctx = createMockCtx();
    const result = await loadMapping(ctx);
    expect(result).toEqual({});
  });

  it("does not touch window.localStorage (throws in the addon sandbox)", async () => {
    const ctx = createMockCtx();
    const spy = vi.spyOn(Storage.prototype, "getItem");
    await loadMapping(ctx);
    await saveMapping(ctx, {});
    await loadLastSynced(ctx);
    await saveLastSynced(ctx);
    expect(spy).not.toHaveBeenCalled();
  });
});

// ─── saveMapping ──────────────────────────────────────────────────────────────

describe("saveMapping", () => {
  it("writes serialized mapping to addon storage", async () => {
    const m = { 3: { type: "existing" as const, wfAccountId: "w3" } };
    const ctx = createMockCtx();
    await saveMapping(ctx, m);
    expect(await ctx.api.storage.get(MAPPING_KEY)).toBe(JSON.stringify(m));
  });
});

// ─── loadLastSynced / saveLastSynced ──────────────────────────────────────────

describe("loadLastSynced", () => {
  it("returns null when key is absent", async () => {
    expect(await loadLastSynced(createMockCtx())).toBeNull();
  });

  it("returns null for NaN timestamp", async () => {
    const ctx = createMockCtx();
    await ctx.api.storage.set(LAST_SYNCED_KEY, "not-a-number");
    expect(await loadLastSynced(ctx)).toBeNull();
  });

  it("returns a Date for a valid timestamp", async () => {
    const ts = 1_700_000_000_000;
    const ctx = createMockCtx();
    await ctx.api.storage.set(LAST_SYNCED_KEY, String(ts));
    const result = await loadLastSynced(ctx);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(ts);
  });
});

describe("saveLastSynced", () => {
  it("writes a numeric timestamp to addon storage", async () => {
    const ctx = createMockCtx();
    const before = Date.now();
    await saveLastSynced(ctx);
    const after = Date.now();
    const stored = Number(await ctx.api.storage.get(LAST_SYNCED_KEY));
    expect(stored).toBeGreaterThanOrEqual(before);
    expect(stored).toBeLessThanOrEqual(after);
  });
});
