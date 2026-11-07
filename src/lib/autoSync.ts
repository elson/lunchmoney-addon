import type { AddonContext } from "@wealthfolio/addon-sdk";
import { runBalanceSync, type BalanceSyncOutcome } from "./balanceSync";
import { createAddonHost } from "./addonHost";
import { getApiKey } from "./lunchmoney";
import { loadLastSynced } from "./mapping";

/** Opening Wealthfolio again within this long of a sync doesn't sync again. */
export const AUTO_SYNC_COOLDOWN_MS = 60 * 60 * 1000;

export type AutoSyncOutcome =
  | BalanceSyncOutcome
  | { status: "skipped"; reason: "no-token" | "recent" };

/** Syncs linked balances when Wealthfolio starts, unless it synced recently. Never throws. */
export async function autoSyncOnStartup(
  ctx: AddonContext,
  now: Date = new Date(),
): Promise<AutoSyncOutcome> {
  const { logger } = ctx.api;
  try {
    if (!(await getApiKey(ctx))) return { status: "skipped", reason: "no-token" };
    const last = await loadLastSynced(ctx);
    if (last && now.getTime() - last.getTime() < AUTO_SYNC_COOLDOWN_MS) {
      return { status: "skipped", reason: "recent" };
    }

    const outcome = await runBalanceSync(createAddonHost(ctx), now.toISOString().slice(0, 10));
    if (outcome.status === "synced") {
      logger.info(
        `Lunch Money sync: ${outcome.imported} of ${outcome.checked} linked balances updated`,
      );
    } else if (outcome.status === "failed") {
      logger.error(`Lunch Money sync failed: ${outcome.errors.join("; ")}`);
    }
    return outcome;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Lunch Money sync failed: ${message}`);
    return { status: "failed", errors: [message] };
  }
}
