import type { AddonContext, Account } from "@wealthfolio/addon-sdk";
import type { LunchmoneyAccount } from "./lunchmoney";
import { fetchAllAccounts } from "./lunchmoney";
import { loadMapping, saveMapping, cleanMapping } from "./mapping";
import { importChangedBalances } from "./balanceSync";
import { createAddonHost, loadCashBalances as loadValuations } from "./addonHost";
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
      const { imported, errors } = await importChangedBalances(
        createAddonHost(ctx),
        savedMapping,
        lmAccounts,
        wfCashBalances,
        today,
      );
      if (errors.length > 0) return { ok: false, errors };

      const lastSynced = new Date();
      if (imported === 0) return { ok: true, lastSynced, wfCashBalances, imported };
      const reloaded = await loadValuations(ctx, [
        ...new Set([...Object.keys(wfCashBalances), ...linkedWfIds(savedMapping)]),
      ]);
      return { ok: true, lastSynced, wfCashBalances: { ...wfCashBalances, ...reloaded }, imported };
    },
  };
}
