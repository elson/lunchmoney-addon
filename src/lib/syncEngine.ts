import type { AddonContext, Account } from "@wealthfolio/addon-sdk";
import type { LunchmoneyAccount } from "./lunchmoney";
import { fetchAllAccounts } from "./lunchmoney";
import { loadMapping, saveMapping, saveLastSynced, cleanMapping } from "./mapping";
import { balancesMatch } from "./balances";
import type { AccountMapping } from "../types";

export interface LoadResult {
  lmAccounts: LunchmoneyAccount[];
  wfAccounts: Account[];
  savedMapping: AccountMapping;
  wfCashBalances: Record<string, number>;
}

export interface ConfirmResult {
  savedMapping: AccountMapping;
  wfAccounts: Account[];
}

export type SyncBalancesResult =
  | { ok: true; lastSynced: Date; wfCashBalances: Record<string, number>; imported: number }
  | { ok: false; errors: string[] };

export interface SyncEngine {
  loadAll(): Promise<LoadResult>;
  /** Re-reads Wealthfolio accounts and balances only — no Lunch Money calls. */
  refreshWealthfolio(
    savedMapping: AccountMapping,
  ): Promise<Pick<LoadResult, "wfAccounts" | "wfCashBalances">>;
  confirm(draft: AccountMapping, lmAccounts: LunchmoneyAccount[]): Promise<ConfirmResult>;
  /** Imports Lunch Money balances for linked accounts whose Wealthfolio balance differs. */
  syncBalances(
    savedMapping: AccountMapping,
    lmAccounts: LunchmoneyAccount[],
    wfCashBalances?: Record<string, number>,
  ): Promise<SyncBalancesResult>;
}

async function createWfAccountFromLm(ctx: AddonContext, lm: LunchmoneyAccount): Promise<Account> {
  return ctx.api.accounts.create({
    name: lm.display_name || lm.name,
    accountType: "CASH",
    currency: lm.currency.toUpperCase(),
    isDefault: false,
    isActive: true,
    trackingMode: "HOLDINGS",
    group: lm.institution_name || undefined,
  });
}

async function saveSnapshot(
  ctx: AddonContext,
  wfAccountId: string,
  currency: string,
  balance: string,
  snapshotDate: string,
): Promise<void> {
  await ctx.api.snapshots.save(
    wfAccountId,
    [],
    { [currency.toUpperCase()]: balance },
    snapshotDate,
  );
}

async function loadValuations(
  ctx: AddonContext,
  wfIds: readonly string[],
): Promise<Record<string, number>> {
  if (wfIds.length === 0) return {};
  try {
    const valuations = await ctx.api.portfolio.getLatestValuations([...wfIds]);
    const balances: Record<string, number> = {};
    for (const v of valuations) {
      balances[v.accountId] = v.cashBalance;
    }
    return balances;
  } catch {
    return {};
  }
}

function linkedWfIds(mapping: AccountMapping): string[] {
  return Object.values(mapping)
    .filter((e): e is { type: "existing"; wfAccountId: string } => e.type === "existing")
    .map((e) => e.wfAccountId);
}

/** Linked accounts plus every account a Lunch Money account could be linked to. */
function balanceCandidates(mapping: AccountMapping, wfAccounts: Account[]): string[] {
  const ids = new Set(linkedWfIds(mapping));
  for (const a of wfAccounts) if (a.trackingMode === "HOLDINGS") ids.add(String(a.id));
  return [...ids];
}

export function createSyncEngine(ctx: AddonContext): SyncEngine {
  return {
    async loadAll() {
      const [lmData, wfData, mapping] = await Promise.all([
        fetchAllAccounts(ctx),
        ctx.api.accounts.getAll(),
        loadMapping(ctx),
      ]);

      const wfIdSet = new Set(wfData.map((a) => String(a.id)));
      const lmIdSet = new Set(lmData.map((a) => a.id));
      const cleaned = cleanMapping(mapping, wfIdSet, lmIdSet);

      // Persist immediately if stale entries were removed, so they don't
      // re-lock WF accounts on the next load before a Save is triggered.
      if (Object.keys(cleaned).length !== Object.keys(mapping).length) {
        await saveMapping(ctx, cleaned);
      }

      const wfCashBalances = await loadValuations(ctx, balanceCandidates(cleaned, wfData));
      return { lmAccounts: lmData, wfAccounts: wfData, savedMapping: cleaned, wfCashBalances };
    },

    async refreshWealthfolio(savedMapping) {
      const wfAccounts = await ctx.api.accounts.getAll();
      const wfCashBalances = await loadValuations(ctx, balanceCandidates(savedMapping, wfAccounts));
      return { wfAccounts, wfCashBalances };
    },

    async confirm(draft, lmAccounts) {
      const finalDraft: AccountMapping = { ...draft };

      for (const [idStr, entry] of Object.entries(draft)) {
        if (entry.type !== "create") continue;
        const lmId = Number(idStr);
        const lm = lmAccounts.find((a) => a.id === lmId);
        if (!lm) continue;

        const created = await createWfAccountFromLm(ctx, lm);
        finalDraft[lmId] = { type: "existing", wfAccountId: String(created.id) };
      }

      await saveMapping(ctx, finalDraft);
      const wfAccounts = await ctx.api.accounts.getAll();
      return { savedMapping: finalDraft, wfAccounts };
    },

    async syncBalances(savedMapping, lmAccounts, wfCashBalances = {}) {
      const today = new Date().toISOString().slice(0, 10);
      const errors: string[] = [];
      let imported = 0;

      for (const [idStr, entry] of Object.entries(savedMapping)) {
        if (entry.type !== "existing") continue;
        const lmId = Number(idStr);
        const lm = lmAccounts.find((a) => a.id === lmId);
        if (!lm) continue;
        const current = wfCashBalances[entry.wfAccountId];
        if (current !== undefined && balancesMatch(current, parseFloat(lm.balance))) continue;

        try {
          await saveSnapshot(ctx, entry.wfAccountId, lm.currency, lm.balance, today);
          imported++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.api.logger.error(`Balance sync failed for LM account ${lmId}: ${msg}`);
          errors.push(msg);
        }
      }

      if (errors.length > 0) {
        return { ok: false, errors };
      }

      await saveLastSynced(ctx);
      const lastSynced = new Date();
      if (imported === 0) return { ok: true, lastSynced, wfCashBalances, imported };
      await ctx.api.portfolio.update();
      const reloaded = await loadValuations(ctx, [
        ...new Set([...Object.keys(wfCashBalances), ...linkedWfIds(savedMapping)]),
      ]);
      return { ok: true, lastSynced, wfCashBalances: { ...wfCashBalances, ...reloaded }, imported };
    },
  };
}
