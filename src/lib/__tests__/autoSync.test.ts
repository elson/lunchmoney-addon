import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTO_SYNC_COOLDOWN_MS, autoSyncOnStartup } from "../autoSync";
import { createMockCtx } from "../../test/mockCtx";

vi.mock("../balanceSync", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, runBalanceSync: vi.fn() };
});

import { runBalanceSync } from "../balanceSync";

const NOW = new Date("2026-11-07T08:00:00Z");
const LAST_SYNCED_KEY = "lunchmoney-addon:last-synced";

function ctxWithToken() {
  const ctx = createMockCtx();
  vi.mocked(ctx.api.secrets.get).mockResolvedValue("lm-token");
  return ctx;
}

beforeEach(() => {
  vi.mocked(runBalanceSync).mockReset();
  vi.mocked(runBalanceSync).mockResolvedValue({ status: "synced", checked: 2, imported: 1 });
});

describe("autoSyncOnStartup", () => {
  it("skips when no Lunch Money token is saved", async () => {
    const ctx = createMockCtx();
    expect(await autoSyncOnStartup(ctx, NOW)).toEqual({ status: "skipped", reason: "no-token" });
    expect(runBalanceSync).not.toHaveBeenCalled();
  });

  it("skips when the last sync was within the cooldown", async () => {
    const ctx = ctxWithToken();
    await ctx.api.storage.set(LAST_SYNCED_KEY, String(NOW.getTime() - AUTO_SYNC_COOLDOWN_MS + 1));
    expect(await autoSyncOnStartup(ctx, NOW)).toEqual({ status: "skipped", reason: "recent" });
    expect(runBalanceSync).not.toHaveBeenCalled();
  });

  it("syncs with today's UTC date when the last sync is older than the cooldown", async () => {
    const ctx = ctxWithToken();
    await ctx.api.storage.set(LAST_SYNCED_KEY, String(NOW.getTime() - AUTO_SYNC_COOLDOWN_MS));

    const outcome = await autoSyncOnStartup(ctx, NOW);

    expect(outcome).toEqual({ status: "synced", checked: 2, imported: 1 });
    expect(runBalanceSync).toHaveBeenCalledWith(expect.any(Object), "2026-11-07");
    expect(ctx.api.logger.info).toHaveBeenCalledWith(
      "Lunch Money sync: 1 of 2 linked balances updated",
    );
  });

  it("syncs when it has never synced", async () => {
    const ctx = ctxWithToken();
    await autoSyncOnStartup(ctx, NOW);
    expect(runBalanceSync).toHaveBeenCalled();
  });

  it("logs failures without throwing", async () => {
    const ctx = ctxWithToken();
    vi.mocked(runBalanceSync).mockResolvedValue({ status: "failed", errors: ["a", "b"] });
    expect(await autoSyncOnStartup(ctx, NOW)).toEqual({ status: "failed", errors: ["a", "b"] });
    expect(ctx.api.logger.error).toHaveBeenCalledWith("Lunch Money sync failed: a; b");
  });

  it("turns an unexpected error into a logged failure", async () => {
    const ctx = ctxWithToken();
    vi.mocked(runBalanceSync).mockRejectedValue(new Error("offline"));
    expect(await autoSyncOnStartup(ctx, NOW)).toEqual({ status: "failed", errors: ["offline"] });
    expect(ctx.api.logger.error).toHaveBeenCalledWith("Lunch Money sync failed: offline");
  });

  it("stays quiet when nothing is linked", async () => {
    const ctx = ctxWithToken();
    vi.mocked(runBalanceSync).mockResolvedValue({ status: "nothing-linked" });
    await autoSyncOnStartup(ctx, NOW);
    expect(ctx.api.logger.info).not.toHaveBeenCalled();
    expect(ctx.api.logger.error).not.toHaveBeenCalled();
  });
});
