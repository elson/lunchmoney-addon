import { useState, useEffect } from "react";
import type { AddonContext, Account } from "@wealthfolio/addon-sdk";
import { fetchAllAccounts, type LunchmoneyAccount } from "../lib/lunchmoney";
import { createWfAccountFromLm, saveSnapshot } from "../lib/wealthfolio";
import { API_KEY_SECRET } from "../lib/secrets";
import {
  loadMapping,
  saveMapping,
  loadLastSynced,
  saveLastSynced,
  mappingsEqual,
  cleanMapping,
} from "../lib/mapping";
import type { AccountMapping, MappingEntry } from "../types";

export type BalanceSyncStatus = "syncing" | "ok" | "error";

interface AccountSyncState {
  lmAccounts: LunchmoneyAccount[] | null;
  wfAccounts: Account[] | null;
  savedMapping: AccountMapping;
  draft: AccountMapping;
  loading: boolean;
  error: string | null;
  hasApiKey: boolean | null;
  isSaving: boolean;
  isDirty: boolean;
  lastSynced: Date | null;
  isSyncingBalances: boolean;
  balanceSyncStatus: Record<number, BalanceSyncStatus>;
}

interface AccountSyncActions {
  handleRefresh: () => void;
  handleDraftChange: (lmId: number, entry: MappingEntry) => void;
  handleConfirm: () => Promise<void>;
  handleUndo: () => void;
  handleSyncBalances: () => Promise<void>;
}

export function useAccountSync(
  ctx: AddonContext,
  paused: boolean,
): AccountSyncState & AccountSyncActions {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [lmAccounts, setLmAccounts] = useState<LunchmoneyAccount[] | null>(null);
  const [wfAccounts, setWfAccounts] = useState<Account[] | null>(null);
  const [savedMapping, setSavedMapping] = useState<AccountMapping>({});
  const [draft, setDraft] = useState<AccountMapping>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(() => loadLastSynced());
  const [isSyncingBalances, setIsSyncingBalances] = useState(false);
  const [balanceSyncStatus, setBalanceSyncStatus] = useState<Record<number, BalanceSyncStatus>>({});

  useEffect(() => {
    if (paused) return;
    ctx.api.secrets.get(API_KEY_SECRET).then((key) => {
      setHasApiKey(!!key);
      setApiKey(key);
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
      const cleaned = cleanMapping(mapping, wfIdSet);

      saveLastSynced();
      setLastSynced(new Date());
      setLmAccounts(lmData);
      setWfAccounts(wfData);
      setSavedMapping(cleaned);
      setDraft(cleaned);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch accounts");
    } finally {
      setLoading(false);
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
    const nextStatus: Record<number, BalanceSyncStatus> = {};

    for (const [idStr, entry] of Object.entries(savedMapping)) {
      if (entry.type !== "existing") continue;
      const lmId = Number(idStr);
      const lm = lmAccounts.find((a) => a.id === lmId);
      if (!lm) continue;

      nextStatus[lmId] = "syncing";
      setBalanceSyncStatus({ ...nextStatus });

      try {
        await saveSnapshot(entry.wfAccountId, lm.currency, lm.balance, today);
        nextStatus[lmId] = "ok";
      } catch {
        nextStatus[lmId] = "error";
      }
      setBalanceSyncStatus({ ...nextStatus });
    }

    setIsSyncingBalances(false);
  }

  return {
    lmAccounts,
    wfAccounts,
    savedMapping,
    draft,
    loading,
    error,
    hasApiKey,
    isSaving,
    isDirty: !mappingsEqual(draft, savedMapping),
    lastSynced,
    isSyncingBalances,
    balanceSyncStatus,
    handleRefresh,
    handleDraftChange,
    handleUndo,
    handleConfirm,
    handleSyncBalances,
  };
}
