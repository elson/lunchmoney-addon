import type { LunchmoneyAccount } from "./lunchmoney";
import type { AccountMapping } from "../types";
import { balancesMatch } from "./balances";

/**
 * What a balance sync needs from wherever it runs. The add-on supplies it from
 * the add-on API (`ctx.api`); the companion container from Wealthfolio's REST
 * API. Lunch Money is only ever read.
 */
export interface BalanceSyncHost {
  fetchLunchMoneyAccounts(): Promise<LunchmoneyAccount[]>;
  loadMapping(): Promise<AccountMapping>;
  listWealthfolioAccountIds(): Promise<string[]>;
  /** Cash balance per Wealthfolio account; accounts without a valuation are left out. */
  latestCashBalances(wfAccountIds: string[]): Promise<Record<string, number>>;
  saveCashSnapshot(
    wfAccountId: string,
    currency: string,
    balance: string,
    date: string,
  ): Promise<void>;
  updatePortfolio(): Promise<void>;
  saveLastSynced(): Promise<void>;
  logError(message: string): void;
}

export interface ImportResult {
  imported: number;
  errors: string[];
}

export type BalanceSyncOutcome =
  | { status: "nothing-linked" }
  | { status: "synced"; checked: number; imported: number }
  | { status: "failed"; errors: string[] };

type LinkedEntry = [lmId: number, wfAccountId: string];

function linkedEntries(mapping: AccountMapping): LinkedEntry[] {
  return Object.entries(mapping).flatMap(([id, entry]): LinkedEntry[] =>
    entry.type === "existing" ? [[Number(id), entry.wfAccountId]] : [],
  );
}

/**
 * Saves a cash snapshot for every linked account whose Lunch Money balance
 * differs from Wealthfolio's. On success it records the sync time, then asks
 * Wealthfolio to recalculate if anything changed.
 */
export async function importChangedBalances(
  host: BalanceSyncHost,
  mapping: AccountMapping,
  lmAccounts: readonly LunchmoneyAccount[],
  wfCashBalances: Record<string, number>,
  today: string,
): Promise<ImportResult> {
  const errors: string[] = [];
  let imported = 0;

  for (const [lmId, wfAccountId] of linkedEntries(mapping)) {
    const lm = lmAccounts.find((a) => a.id === lmId);
    if (!lm) continue;
    const current = wfCashBalances[wfAccountId];
    if (current !== undefined && balancesMatch(current, parseFloat(lm.balance))) continue;

    try {
      await host.saveCashSnapshot(wfAccountId, lm.currency.toUpperCase(), lm.balance, today);
      imported++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      host.logError(`Balance sync failed for LM account ${lmId}: ${msg}`);
      errors.push(msg);
    }
  }

  if (errors.length > 0) return { imported, errors };
  await host.saveLastSynced();
  if (imported > 0) await host.updatePortfolio();
  return { imported, errors };
}

/** A whole unattended sync: reads the saved links, Lunch Money and Wealthfolio, then imports. */
export async function runBalanceSync(
  host: BalanceSyncHost,
  today: string,
): Promise<BalanceSyncOutcome> {
  const linked = linkedEntries(await host.loadMapping());
  if (linked.length === 0) return { status: "nothing-linked" };

  const [lmAccounts, wfIds] = await Promise.all([
    host.fetchLunchMoneyAccounts(),
    host.listWealthfolioAccountIds(),
  ]);
  const existing = new Set(wfIds);
  const live = linked.filter(([, wfId]) => existing.has(wfId));
  if (!live.some(([lmId]) => lmAccounts.some((a) => a.id === lmId))) {
    return { status: "failed", errors: ["Lunch Money returned none of the linked accounts"] };
  }

  const mapping: AccountMapping = Object.fromEntries(
    live.map(([lmId, wfAccountId]) => [lmId, { type: "existing", wfAccountId }]),
  );
  const balances = await host.latestCashBalances(live.map(([, wfId]) => wfId));
  const { imported, errors } = await importChangedBalances(
    host,
    mapping,
    lmAccounts,
    balances,
    today,
  );
  if (errors.length > 0) return { status: "failed", errors };
  return { status: "synced", checked: live.length, imported };
}
