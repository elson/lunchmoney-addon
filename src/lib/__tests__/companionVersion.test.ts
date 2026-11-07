import { describe, expect, it, vi } from "vitest";
import { loadCompanionMismatch, recordAddonVersion } from "../companionVersion";
import { VERSION } from "../version";
import { createMockCtx } from "../../test/mockCtx";

describe("recordAddonVersion", () => {
  it("records this add-on's version for the companion to read", async () => {
    const ctx = createMockCtx();
    await recordAddonVersion(ctx);
    expect(await ctx.api.storage.get("lunchmoney-addon:addon-version")).toBe(VERSION);
  });

  it("doesn't write when the recorded version is already current", async () => {
    const ctx = createMockCtx();
    await ctx.api.storage.set("lunchmoney-addon:addon-version", VERSION);
    vi.mocked(ctx.api.storage.set).mockClear();
    await recordAddonVersion(ctx);
    expect(ctx.api.storage.set).not.toHaveBeenCalled();
  });

  it("logs rather than throws when storage fails", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.storage.get).mockRejectedValue(new Error("down"));
    await expect(recordAddonVersion(ctx)).resolves.toBeUndefined();
    expect(ctx.api.logger.warn).toHaveBeenCalledWith(
      "Couldn't record the add-on version for the sync companion: down",
    );
  });
});

describe("loadCompanionMismatch", () => {
  it("is null when no companion has ever run", async () => {
    expect(await loadCompanionMismatch(createMockCtx())).toBeNull();
  });

  it("is null when the companion runs this version", async () => {
    const ctx = createMockCtx();
    await ctx.api.storage.set(
      "lunchmoney-addon:companion",
      JSON.stringify({ version: VERSION, lastRunAt: "2026-11-07T06:00:00Z" }),
    );
    expect(await loadCompanionMismatch(ctx)).toBeNull();
  });

  it("says what to update when the companion runs another version", async () => {
    const ctx = createMockCtx();
    await ctx.api.storage.set(
      "lunchmoney-addon:companion",
      JSON.stringify({ version: "0.0.1", lastRunAt: "2026-11-07T06:00:00Z" }),
    );
    expect(await loadCompanionMismatch(ctx)).toEqual({
      outdated: "companion",
      message: `The sync companion is on v0.0.1 but the add-on is on v${VERSION}. Pull the latest companion image.`,
    });
  });

  it("is null when storage can't be read", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.storage.get).mockRejectedValue(new Error("down"));
    expect(await loadCompanionMismatch(ctx)).toBeNull();
  });
});
