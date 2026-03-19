import type { AddonContext, Account } from "@wealthfolio/addon-sdk";
import type { LunchmoneyAccount } from "./lunchmoney";
import { fetchAllAccounts } from "./lunchmoney";
import { loadMapping, saveMapping, saveLastSynced, cleanMapping } from "./mapping";
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
  | { ok: true; lastSynced: Date; wfCashBalances: Record<string, number> }
  | { ok: false; errors: string[] };

export interface SyncEngine {
  loadAll(apiKey: string): Promise<LoadResult>;
  confirm(draft: AccountMapping, lmAccounts: LunchmoneyAccount[]): Promise<ConfirmResult>;
  syncBalances(
    savedMapping: AccountMapping,
    lmAccounts: LunchmoneyAccount[],
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
  mapping: AccountMapping,
): Promise<Record<string, number>> {
  const wfIds = Object.values(mapping)
    .filter((e): e is { type: "existing"; wfAccountId: string } => e.type === "existing")
    .map((e) => e.wfAccountId);
  if (wfIds.length === 0) return {};
  try {
    const valuations = await ctx.api.portfolio.getLatestValuations(wfIds);
    const balances: Record<string, number> = {};
    for (const v of valuations) {
      balances[v.accountId] = v.cashBalance;
    }
    return balances;
  } catch {
    return {};
  }
}

export function createSyncEngine(ctx: AddonContext): SyncEngine {
  return {
    async loadAll(apiKey) {
      const [lmData, wfData, mapping] = await Promise.all([
        fetchAllAccounts(apiKey),
        ctx.api.accounts.getAll(),
        loadMapping(ctx),
      ]);

      const wfIdSet = new Set(wfData.map((a) => String(a.id)));
      const lmIdSet = new Set(lmData.map((a) => a.id));
      const cleaned = cleanMapping(mapping, wfIdSet, lmIdSet);

      // Persist immediately if stale entries were removed, so they don't
      // re-lock WF accounts on the next load before a Save is triggered.
      if (Object.keys(cleaned).length !== Object.keys(mapping).length) {
        saveMapping(cleaned);
      }

      const wfCashBalances = await loadValuations(ctx, cleaned);
      return { lmAccounts: lmData, wfAccounts: wfData, savedMapping: cleaned, wfCashBalances };
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

      saveMapping(finalDraft);
      const wfAccounts = await ctx.api.accounts.getAll();
      return { savedMapping: finalDraft, wfAccounts };
    },

    async syncBalances(savedMapping, lmAccounts) {
      const today = new Date().toISOString().slice(0, 10);
      const errors: string[] = [];

      for (const [idStr, entry] of Object.entries(savedMapping)) {
        if (entry.type !== "existing") continue;
        const lmId = Number(idStr);
        const lm = lmAccounts.find((a) => a.id === lmId);
        if (!lm) continue;

        try {
          await saveSnapshot(ctx, entry.wfAccountId, lm.currency, lm.balance, today);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.api.logger.error(`Balance sync failed for LM account ${lmId}: ${msg}`);
          errors.push(msg);
        }
      }

      if (errors.length > 0) {
        return { ok: false, errors };
      }

      saveLastSynced();
      const lastSynced = new Date();
      await ctx.api.portfolio.update();
      const wfCashBalances = await loadValuations(ctx, savedMapping);
      return { ok: true, lastSynced, wfCashBalances };
    },
  };
}
