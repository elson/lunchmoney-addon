import type { AddonContext } from "@wealthfolio/addon-sdk";
import type { BalanceSyncHost } from "./balanceSync";
import { fetchAllAccounts } from "./lunchmoney";
import { loadMapping, saveLastSynced } from "./mapping";

/** Cash balance per account; an unreadable valuation leaves the balance unknown. */
export async function loadCashBalances(
  ctx: AddonContext,
  wfIds: readonly string[],
): Promise<Record<string, number>> {
  if (wfIds.length === 0) return {};
  try {
    const valuations = await ctx.api.portfolio.getLatestValuations([...wfIds]);
    return Object.fromEntries(valuations.map((v) => [v.accountId, v.cashBalance]));
  } catch {
    return {};
  }
}

/** The balance sync's host inside Wealthfolio: the add-on API. */
export function createAddonHost(ctx: AddonContext): BalanceSyncHost {
  return {
    fetchLunchMoneyAccounts: () => fetchAllAccounts(ctx),
    loadMapping: () => loadMapping(ctx),
    listWealthfolioAccountIds: async () =>
      (await ctx.api.accounts.getAll()).map((a) => String(a.id)),
    latestCashBalances: (ids) => loadCashBalances(ctx, ids),
    saveCashSnapshot: (wfAccountId, currency, balance, date) =>
      ctx.api.snapshots.save(wfAccountId, [], { [currency]: balance }, date),
    updatePortfolio: () => ctx.api.portfolio.update(),
    saveLastSynced: () => saveLastSynced(ctx),
    logError: (message) => ctx.api.logger.error(message),
  };
}
