import { useState, useEffect, useMemo } from "react";
import type { AddonContext, Account } from "@wealthfolio/addon-sdk";
import { getApiKey, type LunchmoneyAccount } from "../lib/lunchmoney";
import { loadLastSynced } from "../lib/mapping";
import { createSyncEngine } from "../lib/syncEngine";
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

  const engine = useMemo(() => createSyncEngine(ctx), [ctx]);

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
      const r = await engine.loadAll(key);
      setLmAccounts(r.lmAccounts);
      setWfAccounts(r.wfAccounts);
      setSavedMapping(r.savedMapping);
      setDraft(r.savedMapping);
      setWfCashBalances(r.wfCashBalances);
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
      const r = await engine.confirm(draft, lmAccounts!);
      setWfAccounts(r.wfAccounts);
      setSavedMapping(r.savedMapping);
      setDraft(r.savedMapping);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSyncBalances() {
    if (!lmAccounts) return;
    setIsSyncingBalances(true);
    const r = await engine.syncBalances(savedMapping, lmAccounts);
    setIsSyncingBalances(false);
    if (r.ok) {
      setLastSynced(r.lastSynced);
      setWfCashBalances(r.wfCashBalances);
    } else {
      setError(r.errors.join(" | "));
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
