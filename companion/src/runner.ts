import type { BalanceSyncOutcome } from "../../src/lib/balanceSync";
import type { SyncStatus } from "./status";

export function describeOutcome(outcome: BalanceSyncOutcome): string {
  switch (outcome.status) {
    case "synced":
      return outcome.imported === 0
        ? `Synced: all ${outcome.checked} linked balances already match`
        : `Synced: ${outcome.imported} of ${outcome.checked} linked balances updated`;
    case "nothing-linked":
      return "Nothing to sync: no accounts are linked in the add-on yet";
    case "failed":
      return `Sync failed: ${outcome.errors.join("; ")}`;
  }
}

export const exitCodeFor = (outcome: BalanceSyncOutcome): number =>
  outcome.status === "failed" ? 1 : 0;

/**
 * Wraps a sync so a scheduled run that fires while the last one is still going
 * is skipped rather than run twice against the same accounts. Resolves to null
 * when skipped.
 */
export function createRunner(
  sync: () => Promise<BalanceSyncOutcome>,
  log: (message: string) => void,
  status?: SyncStatus,
): () => Promise<BalanceSyncOutcome | null> {
  let running = false;
  return async () => {
    if (running) {
      log("Previous sync still running; skipping this one");
      return null;
    }
    running = true;
    try {
      log("Starting sync");
      status?.started(new Date());
      const outcome = await sync();
      status?.finished(outcome, new Date());
      log(describeOutcome(outcome));
      return outcome;
    } finally {
      running = false;
    }
  };
}
