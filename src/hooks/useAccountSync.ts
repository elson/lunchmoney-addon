import { useState, useEffect, useMemo } from "react";
import type { AddonContext, Account } from "@wealthfolio/addon-sdk";
import { getApiKey, type LunchmoneyAccount } from "../lib/lunchmoney";
import { loadLastSynced } from "../lib/mapping";
import { createSyncEngine, type LoadResult } from "../lib/syncEngine";
import type { AccountMapping, MappingEntry } from "../types";
import { buildAccountViewModel, type AccountViewModel } from "../lib/accountViewModel";

/** How often the open page re-reads Wealthfolio balances (Lunch Money is only read on Sync). */
export const WF_REFRESH_MS = 5_000;

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
  /** Outcome of the most recent sync or import in this session. */
  lastSyncResult: { imported: number } | null;
  busy: {
    saving: boolean;
    syncing: boolean;
  };
  actions: {
    changeDraft: (lmId: number, entry: MappingEntry) => void;
    undo: () => void;
    confirm: (options?: { importBalances?: boolean }) => Promise<void>;
    /** Re-fetch from Lunch Money, then import any linked balances that differ. */
    sync: () => Promise<void>;
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
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ imported: number } | null>(null);
  const [wfCashBalances, setWfCashBalances] = useState<Record<string, number>>({});

  const engine = useMemo(() => createSyncEngine(ctx), [ctx]);

  useEffect(() => {
    loadLastSynced(ctx).then(setLastSynced);
  }, [ctx]);

  useEffect(() => {
    if (paused) return;
    getApiKey(ctx).then((key) => {
      setApiKeyState(key);
      if (key) {
        loadAll();
      } else {
        setLmAccounts(null);
        setWfAccounts(null);
      }
    });
  }, [paused]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep Wealthfolio balances current while the page is open, e.g. after an
  // edit in Wealthfolio itself. Paused while saving or syncing to avoid races.
  const live = !paused && !!apiKey && !!lmAccounts && !isSaving && !isSyncing;
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const r = await engine.refreshWealthfolio(savedMapping);
        if (cancelled) return;
        // Only re-render when something actually changed.
        setWfAccounts((prev) => (sameJson(prev, r.wfAccounts) ? prev : r.wfAccounts));
        setWfCashBalances((prev) => (sameJson(prev, r.wfCashBalances) ? prev : r.wfCashBalances));
      } catch {
        // Keep the last known balances; the next tick will try again.
      }
    }, WF_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [live, engine, savedMapping]);

  function applyLoad(r: LoadResult) {
    setLmAccounts(r.lmAccounts);
    setWfAccounts(r.wfAccounts);
    setSavedMapping(r.savedMapping);
    setDraft(r.savedMapping);
    setWfCashBalances(r.wfCashBalances);
  }

  async function loadAll() {
    setError(null);
    setLoading(true);
    try {
      applyLoad(await engine.loadAll());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch accounts");
    } finally {
      setLoading(false);
    }
  }

  /** Runs an import and records the outcome; returns false on failure. */
  async function importBalances(
    mapping: AccountMapping,
    lm: LunchmoneyAccount[],
    balances: Record<string, number>,
  ) {
    const r = await engine.syncBalances(mapping, lm, balances);
    if (r.ok) {
      setLastSynced(r.lastSynced);
      setWfCashBalances(r.wfCashBalances);
      setLastSyncResult({ imported: r.imported });
    } else {
      setError(r.errors.join(" | "));
    }
  }

  async function handleSync() {
    if (!apiKey) return;
    setError(null);
    setIsSyncing(true);
    try {
      // Quiet reload: keep the current table on screen while syncing.
      const r = await engine.loadAll();
      applyLoad(r);
      const hasLinks = Object.values(r.savedMapping).some((e) => e.type === "existing");
      if (hasLinks) await importBalances(r.savedMapping, r.lmAccounts, r.wfCashBalances);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  }

  function handleDraftChange(lmId: number, entry: MappingEntry) {
    setDraft((prev) => ({ ...prev, [lmId]: entry }));
  }

  function handleUndo() {
    setDraft(savedMapping);
  }

  async function handleConfirm(options: { importBalances?: boolean } = {}) {
    setIsSaving(true);
    try {
      const r = await engine.confirm(draft, lmAccounts!);
      setWfAccounts(r.wfAccounts);
      setSavedMapping(r.savedMapping);
      setDraft(r.savedMapping);
      if (options.importBalances) {
        await importBalances(r.savedMapping, lmAccounts!, wfCashBalances);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
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
    lastSyncResult,
    busy: { saving: isSaving, syncing: isSyncing },
    actions: {
      changeDraft: handleDraftChange,
      undo: handleUndo,
      confirm: handleConfirm,
      sync: handleSync,
    },
  };
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
