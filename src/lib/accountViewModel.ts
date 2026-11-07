import type { Account } from "@wealthfolio/addon-sdk";
import type { LunchmoneyAccount } from "./lunchmoney";
import type { AccountMapping, MappingEntry } from "../types";
import { mappingsEqual } from "./mapping";
import { balancesMatch as balancesEqual } from "./balances";

export type FilterTab = "all" | "linked" | "skipped";

export interface ChangeClassification {
  toCreate: { lm: LunchmoneyAccount; wasLinkedTo?: Account }[];
  toLink: { lm: LunchmoneyAccount; wf: Account }[];
  toRelink: { lm: LunchmoneyAccount; from: Account; to: Account }[];
  toUnlink: { lm: LunchmoneyAccount; wf: Account }[];
  unchanged: { lm: LunchmoneyAccount; wf: Account }[];
  hasChanges: boolean;
}

function classifyChanges(
  draft: AccountMapping,
  savedMapping: AccountMapping,
  lmAccounts: LunchmoneyAccount[],
  wfAccounts: Account[],
): ChangeClassification {
  const lmById = Object.fromEntries(lmAccounts.map((a) => [a.id, a]));
  const wfById = Object.fromEntries(wfAccounts.map((a) => [String(a.id), a]));

  const toCreate: { lm: LunchmoneyAccount; wasLinkedTo?: Account }[] = [];
  const toLink: { lm: LunchmoneyAccount; wf: Account }[] = [];
  const toRelink: { lm: LunchmoneyAccount; from: Account; to: Account }[] = [];
  const toUnlink: { lm: LunchmoneyAccount; wf: Account }[] = [];
  const unchanged: { lm: LunchmoneyAccount; wf: Account }[] = [];

  for (const [idStr, entry] of Object.entries(draft)) {
    const lmId = Number(idStr);
    const lm = lmById[lmId];
    if (!lm) continue;
    const saved = savedMapping[lmId];

    if (entry.type === "create") {
      const wasLinkedTo = saved?.type === "existing" ? wfById[saved.wfAccountId] : undefined;
      toCreate.push({ lm, wasLinkedTo });
    } else if (entry.type === "existing") {
      const wf = wfById[entry.wfAccountId];
      if (!wf) continue;
      if (!saved || saved.type === "ignore") {
        toLink.push({ lm, wf });
      } else if (saved.type === "existing") {
        if (saved.wfAccountId === entry.wfAccountId) {
          unchanged.push({ lm, wf });
        } else {
          const from = wfById[saved.wfAccountId];
          if (from) {
            toRelink.push({ lm, from, to: wf });
          } else {
            toLink.push({ lm, wf });
          }
        }
      }
    }
  }

  for (const [idStr, saved] of Object.entries(savedMapping)) {
    if (saved.type !== "existing") continue;
    const lmId = Number(idStr);
    const draftEntry = draft[lmId];
    if (!draftEntry || draftEntry.type === "ignore") {
      const lm = lmById[lmId];
      const wf = wfById[saved.wfAccountId];
      if (lm && wf) toUnlink.push({ lm, wf });
    }
  }

  const hasChanges =
    toCreate.length > 0 || toLink.length > 0 || toRelink.length > 0 || toUnlink.length > 0;

  return { toCreate, toLink, toRelink, toUnlink, unchanged, hasChanges };
}

function buildGroups(rows: AccountRowVM[]): AccountRowGroup[] {
  const groupMap = new Map<string, AccountRowVM[]>();
  for (const row of rows) {
    const key = row.lm.institution_name || "Other";
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(row);
  }
  return Array.from(groupMap.entries()).map(([institution, groupRows]) => ({
    institution,
    rows: groupRows,
  }));
}

export interface AccountRowVM {
  readonly lm: LunchmoneyAccount;
  readonly entry: MappingEntry;
  readonly isLinked: boolean;
  readonly wfAccount: Account | undefined;
  readonly lmBalance: number;
  readonly wfBalance: number | null;
  readonly balanceDelta: number | null;
  readonly balancesMatch: boolean;
}

export interface AccountRowGroup {
  readonly institution: string;
  readonly rows: readonly AccountRowVM[];
}

export interface LinkCandidate {
  readonly account: Account;
  /** Current Wealthfolio cash balance, or null if unknown. */
  readonly balance: number | null;
  /** Same name, or same currency and balance — probably the right account. */
  readonly suggested: boolean;
  readonly balanceMatches: boolean;
  readonly currencyMatches: boolean;
}

export interface BalanceImport {
  readonly lm: LunchmoneyAccount;
  /** The Wealthfolio account, or null for one that will be created. */
  readonly target: Account | null;
  readonly from: number | null;
  readonly to: number;
}

export interface AccountViewModel {
  readonly rows: readonly AccountRowVM[];
  readonly groups: readonly AccountRowGroup[];
  readonly wfAccounts: readonly Account[];
  readonly linkedCount: number;
  readonly isDirty: boolean;
  readonly claimedWfIds: ReadonlySet<string>;
  /** Lazy — classifyChanges only runs on first access. */
  readonly changes: ChangeClassification;
  /**
   * Returns a new view with rows/groups filtered by search text and tab.
   * Aggregate properties (linkedCount, isDirty, changes, claimedWfIds, wfAccounts)
   * are shared — not recomputed.
   * Returns `this` when search is empty and tab is "all".
   */
  filtered(search: string, tab: FilterTab): AccountViewModel;
  /** Wealthfolio accounts this Lunch Money account can be linked to, suggested ones first. */
  candidatesFor(lmId: number): readonly LinkCandidate[];
  /** Balances that confirming the draft would import (matching ones are skipped). */
  readonly importPlan: readonly BalanceImport[];
  /** Lunch Money accounts the draft skips. */
  readonly skipped: readonly LunchmoneyAccount[];
}

interface ViewModelCore {
  readonly wfAccounts: readonly Account[];
  readonly linkedCount: number;
  readonly isDirty: boolean;
  readonly claimedWfIds: ReadonlySet<string>;
  readonly lazyChanges: () => ChangeClassification;
  readonly candidatesFor: (lmId: number) => readonly LinkCandidate[];
  readonly lazyImportPlan: () => readonly BalanceImport[];
  readonly skipped: readonly LunchmoneyAccount[];
}

const normalizeName = (name: string) => name.trim().toLowerCase();

function linkCandidates(
  lmId: number,
  lmAccounts: readonly LunchmoneyAccount[],
  wfAccounts: readonly Account[],
  draft: AccountMapping,
  wfCashBalances: Record<string, number>,
): LinkCandidate[] {
  const lm = lmAccounts.find((a) => a.id === lmId);
  if (!lm) return [];
  const claimedByOthers = new Set(
    Object.entries(draft)
      .filter(([id, e]) => Number(id) !== lmId && e.type === "existing")
      .map(([, e]) => (e as { wfAccountId: string }).wfAccountId),
  );
  const lmBalance = parseFloat(lm.balance);
  const lmName = normalizeName(lm.display_name ?? lm.name);

  const candidates = wfAccounts
    .filter((a) => a.trackingMode === "HOLDINGS" && !claimedByOthers.has(String(a.id)))
    .map((account): LinkCandidate => {
      const id = String(account.id);
      const balance = id in wfCashBalances ? wfCashBalances[id] : null;
      const currencyMatches = account.currency.toUpperCase() === lm.currency.toUpperCase();
      const balanceMatches = balance !== null && balancesEqual(balance, lmBalance);
      const suggested =
        currencyMatches && (normalizeName(account.name) === lmName || balanceMatches);
      return { account, balance, suggested, balanceMatches, currencyMatches };
    });
  // Stable: suggested first, then same-currency accounts, then ones that can't be linked.
  const rank = (c: LinkCandidate) => (c.suggested ? 0 : c.currencyMatches ? 1 : 2);
  return [...candidates].sort((a, b) => rank(a) - rank(b));
}

function planBalanceImports(
  rows: readonly AccountRowVM[],
  wfCashBalances: Record<string, number>,
): BalanceImport[] {
  const plan: BalanceImport[] = [];
  for (const row of rows) {
    const to = row.lmBalance;
    if (row.entry.type === "create") {
      plan.push({ lm: row.lm, target: null, from: null, to });
    } else if (row.entry.type === "existing" && row.wfAccount) {
      const id = row.entry.wfAccountId;
      const from = id in wfCashBalances ? wfCashBalances[id] : null;
      if (from === null || !balancesEqual(from, to)) {
        plan.push({ lm: row.lm, target: row.wfAccount, from, to });
      }
    }
  }
  return plan;
}

function createView(rows: readonly AccountRowVM[], core: ViewModelCore): AccountViewModel {
  const groups = buildGroups(rows as AccountRowVM[]);
  const vm: AccountViewModel = {
    rows,
    groups,
    wfAccounts: core.wfAccounts,
    linkedCount: core.linkedCount,
    isDirty: core.isDirty,
    claimedWfIds: core.claimedWfIds,
    get changes() {
      return core.lazyChanges();
    },
    candidatesFor: core.candidatesFor,
    get importPlan() {
      return core.lazyImportPlan();
    },
    skipped: core.skipped,
    filtered(search: string, tab: FilterTab): AccountViewModel {
      if (!search.trim() && tab === "all") return vm;
      const query = search.trim().toLowerCase();
      const filteredRows = (rows as AccountRowVM[]).filter((row) => {
        if (query) {
          const haystack = [row.lm.name, row.lm.display_name ?? "", row.lm.institution_name ?? ""]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        if (tab === "linked") return row.isLinked;
        if (tab === "skipped") return !row.isLinked;
        return true;
      });
      return createView(filteredRows, core);
    },
  };
  return vm;
}

export function buildAccountViewModel(
  lmAccounts: LunchmoneyAccount[],
  wfAccounts: Account[],
  draft: AccountMapping,
  savedMapping: AccountMapping,
  wfCashBalances: Record<string, number>,
): AccountViewModel {
  const wfById = new Map<string, Account>(wfAccounts.map((a) => [String(a.id), a]));

  // Pre-compute claimed WF IDs (one pass over draft)
  const claimed = new Set<string>();
  for (const entry of Object.values(draft)) {
    if (entry.type === "existing") claimed.add(entry.wfAccountId);
  }

  // Build one row per LM account
  const rows: AccountRowVM[] = lmAccounts.map((lm) => {
    const entry: MappingEntry = draft[lm.id] ?? { type: "ignore" };
    const isLinked = entry.type === "existing" || entry.type === "create";
    const wfAccount = entry.type === "existing" ? wfById.get(entry.wfAccountId) : undefined;

    const lmBalance = parseFloat(lm.balance);

    const savedEntry = savedMapping[lm.id];
    const wfBalance =
      savedEntry?.type === "existing" && savedEntry.wfAccountId in wfCashBalances
        ? wfCashBalances[savedEntry.wfAccountId]
        : null;

    const balanceDelta = wfBalance !== null ? wfBalance - lmBalance : null;
    const balancesMatch = wfBalance !== null && balancesEqual(wfBalance, lmBalance);

    return { lm, entry, isLinked, wfAccount, lmBalance, wfBalance, balanceDelta, balancesMatch };
  });

  // Count only "existing" entries in savedMapping (intentional — "create" entries aren't saved yet)
  const linkedCount = Object.values(savedMapping).filter((e) => e.type === "existing").length;
  const isDirty = !mappingsEqual(draft, savedMapping);

  let cachedChanges: ChangeClassification | undefined;
  let cachedPlan: readonly BalanceImport[] | undefined;
  const core: ViewModelCore = {
    wfAccounts,
    linkedCount,
    isDirty,
    claimedWfIds: claimed,
    lazyChanges: () =>
      (cachedChanges ??= classifyChanges(draft, savedMapping, lmAccounts, wfAccounts)),
    candidatesFor: (lmId) => linkCandidates(lmId, lmAccounts, wfAccounts, draft, wfCashBalances),
    lazyImportPlan: () => (cachedPlan ??= planBalanceImports(rows, wfCashBalances)),
    skipped: rows.filter((r) => r.entry.type === "ignore").map((r) => r.lm),
  };

  return createView(rows, core);
}
