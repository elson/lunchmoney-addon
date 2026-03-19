import type { Account } from "@wealthfolio/addon-sdk";
import type { LunchmoneyAccount } from "./lunchmoney";
import type { AccountMapping, MappingEntry } from "../types";
import { classifyChanges, type ChangeClassification } from "./classifyChanges";
import { mappingsEqual } from "./mapping";

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

export interface AccountViewModel {
  readonly rows: readonly AccountRowVM[];
  readonly groups: readonly AccountRowGroup[];
  readonly wfAccounts: readonly Account[];
  readonly linkedCount: number;
  readonly isDirty: boolean;
  readonly claimedWfIds: ReadonlySet<string>;
  /** Lazy — classifyChanges only runs on first access. */
  readonly changes: ChangeClassification;
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
    const balancesMatch = balanceDelta !== null && Math.abs(balanceDelta) < 0.005;

    return { lm, entry, isLinked, wfAccount, lmBalance, wfBalance, balanceDelta, balancesMatch };
  });

  // Group rows by institution (preserving encounter order)
  const groupMap = new Map<string, AccountRowVM[]>();
  for (const row of rows) {
    const key = row.lm.institution_name || "Other";
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(row);
  }
  const groups: AccountRowGroup[] = Array.from(groupMap.entries()).map(
    ([institution, groupRows]) => ({ institution, rows: groupRows }),
  );

  // Count only "existing" entries in savedMapping (intentional — "create" entries aren't saved yet)
  const linkedCount = Object.values(savedMapping).filter((e) => e.type === "existing").length;

  const isDirty = !mappingsEqual(draft, savedMapping);

  // Lazy getter — change classification is deferred until first access
  let cachedChanges: ChangeClassification | undefined;

  const vm = {
    rows,
    groups,
    wfAccounts,
    linkedCount,
    isDirty,
    claimedWfIds: claimed,
  } as unknown as AccountViewModel;
  Object.defineProperty(vm, "changes", {
    get() {
      if (!cachedChanges) {
        cachedChanges = classifyChanges(draft, savedMapping, lmAccounts, wfAccounts);
      }
      return cachedChanges;
    },
    enumerable: true,
  });
  return vm;
}
