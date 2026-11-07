// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createRunner, describeOutcome, exitCodeFor } from "../runner";
import { createSyncStatus } from "../status";
import type { BalanceSyncOutcome } from "../../../src/lib/balanceSync";

describe("describeOutcome", () => {
  it.each<[BalanceSyncOutcome, string]>([
    [{ status: "synced", checked: 3, imported: 1 }, "Synced: 1 of 3 linked balances updated"],
    [{ status: "synced", checked: 2, imported: 0 }, "Synced: all 2 linked balances already match"],
    [{ status: "nothing-linked" }, "Nothing to sync: no accounts are linked in the add-on yet"],
    [{ status: "failed", errors: ["a", "b"] }, "Sync failed: a; b"],
  ])("describes %o", (outcome, text) => {
    expect(describeOutcome(outcome)).toBe(text);
  });
});

describe("exitCodeFor", () => {
  it("is non-zero only for a failure", () => {
    expect(exitCodeFor({ status: "synced", checked: 1, imported: 1 })).toBe(0);
    expect(exitCodeFor({ status: "nothing-linked" })).toBe(0);
    expect(exitCodeFor({ status: "failed", errors: [] })).toBe(1);
  });
});

describe("createRunner", () => {
  it("logs each run's outcome", async () => {
    const log = vi.fn();
    const run = createRunner(async () => ({ status: "nothing-linked" }), log);
    await run();
    expect(log).toHaveBeenCalledWith("Starting sync");
    expect(log).toHaveBeenCalledWith("Nothing to sync: no accounts are linked in the add-on yet");
  });

  it("skips a run that starts while the previous one is still going", async () => {
    let finish!: () => void;
    const sync = vi.fn(
      () =>
        new Promise<{ status: "nothing-linked" }>((resolve) => {
          finish = () => resolve({ status: "nothing-linked" });
        }),
    );
    const log = vi.fn();
    const run = createRunner(sync, log);

    const first = run();
    expect(await run()).toBeNull();
    expect(log).toHaveBeenCalledWith("Previous sync still running; skipping this one");
    finish();
    await first;
    expect(sync).toHaveBeenCalledTimes(1);

    run();
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it("records each run in the status", async () => {
    const status = createSyncStatus("1.0.0");
    const run = createRunner(async () => ({ status: "failed", errors: ["x"] }), vi.fn(), status);
    await run();
    expect(status.snapshot()).toMatchObject({
      healthy: false,
      running: false,
      lastRun: { outcome: { status: "failed", errors: ["x"] } },
    });
  });
});
