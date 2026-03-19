import { useState, useEffect, useMemo } from "react";
import type { AddonContext, Account } from "@wealthfolio/addon-sdk";
import { fetchAllAccounts, getApiKey, type LunchmoneyAccount } from "../lib/lunchmoney";
import { createWfAccountFromLm, saveSnapshot } from "../lib/wealthfolio";
import {
  loadMapping,
  saveMapping,
  loadLastSynced,
  saveLastSynced,
  cleanMapping,
} from "../lib/mapping";
import type { AccountMapping, MappingEntry } from "../types";
import { buildAccountViewModel, type AccountViewModel } from "../lib/accountViewModel";

export type SyncPhase = "checking" | "no-api-key" | "loading" | "empty" | "ready";

export type SyncStatus =
  | { phase: "checking" }
  | { phase: "no-api-key" }
  | { phase: "loading" }
  | { phase: "empty" }
  | { phase: "ready"; vm: AccountViewModel };

export interface AccountSyncController {
  status: SyncStatus;
  error: string | null;
  lastSynced: Date | null;
  busy: {
    saving: boolean;
    syncing: boolean;
    refreshing: boolean;
  };
  actions: {
    refresh: () => void;
    changeDraft: (lmId: number, entry: MappingEntry) => void;
    undo: () => void;
    confirm: () => Promise<void>;
    syncBalances: () => Promise<void>;
  };
}

export function deriveStatus(
  apiKey: string | null | undefined,
  loading: boolean,
  lmAccounts: LunchmoneyAccount[] | null,
  vm: AccountViewModel | null,
): SyncStatus {
  if (apiKey === undefined) return { phase: "checking" };
  if (apiKey === null) return { phase: "no-api-key" };
  if (loading) return { phase: "loading" };
  if (lmAccounts?.length === 0) return { phase: "empty" };
  if (vm) return { phase: "ready", vm };
  return { phase: "checking" };
}

export function useAccountSync(ctx: AddonContext, paused: boolean): AccountSyncController {
  const [apiKey, setApiKeyState] = useState<string | null | undefined>(undefined);
  const [lmAccounts, setLmAccounts] = useState<LunchmoneyAccount[] | null>(null);
  const [wfAccounts, setWfAccounts] = useState<Account[] | null>(null);
  const [savedMapping, setSavedMapping] = useState<AccountMapping>({});
  const [draft, setDraft] = useState<AccountMapping>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(() => loadLastSynced());
  const [isSyncingBalances, setIsSyncingBalances] = useState(false);
  const [wfCashBalances, setWfCashBalances] = useState<Record<string, number>>({});

  useEffect(() => {
    if (paused) return;
    getApiKey(ctx).then((key) => {
      setApiKeyState(key);
      if (key) {
        loadAll(key);
      } else {
        setLmAccounts(null);
        setWfAccounts(null);
      }
    });
  }, [paused]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll(key: string) {
    setError(null);
    setLoading(true);
    try {
      const [lmData, wfData, mapping] = await Promise.all([
        fetchAllAccounts(key),
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

      setLmAccounts(lmData);
      setWfAccounts(wfData);
      setSavedMapping(cleaned);
      setDraft(cleaned);
      await loadValuations(cleaned);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch accounts");
    } finally {
      setLoading(false);
    }
  }

  async function loadValuations(mapping: AccountMapping) {
    const wfIds = Object.values(mapping)
      .filter((e): e is { type: "existing"; wfAccountId: string } => e.type === "existing")
      .map((e) => e.wfAccountId);
    if (wfIds.length === 0) {
      setWfCashBalances({});
      return;
    }
    try {
      const valuations = await ctx.api.portfolio.getLatestValuations(wfIds);
      const balances: Record<string, number> = {};
      for (const v of valuations) {
        balances[v.accountId] = v.cashBalance;
      }
      setWfCashBalances(balances);
    } catch {
      // non-fatal: balance display stays empty
    }
  }

  function handleRefresh() {
    if (apiKey) loadAll(apiKey);
  }

  function handleDraftChange(lmId: number, entry: MappingEntry) {
    setDraft((prev) => ({ ...prev, [lmId]: entry }));
  }

  function handleUndo() {
    setDraft(savedMapping);
  }

  async function handleConfirm() {
    setIsSaving(true);
    try {
      const finalDraft: AccountMapping = { ...draft };

      for (const [idStr, entry] of Object.entries(draft)) {
        if (entry.type !== "create") continue;
        const lmId = Number(idStr);
        const lm = lmAccounts?.find((a) => a.id === lmId);
        if (!lm) continue;

        const created = await createWfAccountFromLm(ctx, lm);
        finalDraft[lmId] = { type: "existing", wfAccountId: String(created.id) };
      }

      saveMapping(finalDraft);

      const wfData = await ctx.api.accounts.getAll();
      setWfAccounts(wfData);
      setSavedMapping(finalDraft);
      setDraft(finalDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSyncBalances() {
    if (!lmAccounts) return;
    setIsSyncingBalances(true);
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

    setIsSyncingBalances(false);
    if (errors.length > 0) {
      setError(errors.join(" | "));
    } else {
      saveLastSynced();
      setLastSynced(new Date());
      await ctx.api.portfolio.update();
      await loadValuations(savedMapping);
    }
  }

  const vm = useMemo(
    () =>
      lmAccounts && wfAccounts
        ? buildAccountViewModel(lmAccounts, wfAccounts, draft, savedMapping, wfCashBalances)
        : null,
    [lmAccounts, wfAccounts, draft, savedMapping, wfCashBalances],
  );

  return {
    status: deriveStatus(apiKey, loading, lmAccounts, vm),
    error,
    lastSynced,
    busy: { saving: isSaving, syncing: isSyncingBalances, refreshing: loading },
    actions: {
      refresh: handleRefresh,
      changeDraft: handleDraftChange,
      undo: handleUndo,
      confirm: handleConfirm,
      syncBalances: handleSyncBalances,
    },
  };
}
