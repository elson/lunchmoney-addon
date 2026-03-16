import React from "react";
import type { Account } from "@wealthfolio/addon-sdk";
import {
  Icons,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wealthfolio/ui";
import type { LunchmoneyAccount } from "../lib/lunchmoney";
import type { AccountMapping, MappingEntry } from "../types";
import { claimedWfIds } from "../lib/mapping";
import type { BalanceSyncStatus } from "../hooks/useAccountSync";

function SyncStatusIcon({ status }: { status: BalanceSyncStatus | undefined }) {
  if (status === "syncing")
    return (
      <svg
        className="text-muted-foreground h-4 w-4 animate-spin"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    );
  if (status === "ok")
    return (
      <svg
        className="h-4 w-4 text-green-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  if (status === "error")
    return (
      <svg
        className="text-destructive h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  return null;
}

function entryToSelectValue(entry: MappingEntry): string {
  if (entry.type === "ignore") return "ignore";
  if (entry.type === "create") return "create";
  return `existing:${entry.wfAccountId}`;
}

function selectValueToEntry(val: string): MappingEntry {
  if (val === "ignore") return { type: "ignore" };
  if (val === "create") return { type: "create" };
  if (val.startsWith("existing:")) {
    return { type: "existing", wfAccountId: val.slice("existing:".length) };
  }
  return { type: "ignore" };
}

interface AccountLinkTableProps {
  lmAccounts: LunchmoneyAccount[];
  wfAccounts: Account[];
  draft: AccountMapping;
  savedMapping: AccountMapping;
  balanceSyncStatus: Record<number, BalanceSyncStatus>;
  onDraftChange: (lmId: number, entry: MappingEntry) => void;
}

interface WfAccountSelectProps {
  lmId: number;
  wfAccounts: Account[];
  draft: AccountMapping;
  onDraftChange: (lmId: number, entry: MappingEntry) => void;
}

function WfAccountSelect({ lmId, wfAccounts, draft, onDraftChange }: WfAccountSelectProps) {
  const claimed = claimedWfIds(draft);
  const currentEntry: MappingEntry = draft[lmId] ?? { type: "ignore" };
  const currentValue = entryToSelectValue(currentEntry);

  const currentWfId = currentEntry.type === "existing" ? currentEntry.wfAccountId : null;

  const available = wfAccounts.filter(
    (a) => !claimed.has(String(a.id)) || String(a.id) === currentWfId,
  );

  return (
    <Select
      value={currentValue}
      onValueChange={(val) => onDraftChange(lmId, selectValueToEntry(val))}
    >
      <SelectTrigger className="h-8 w-[200px] text-sm">
        <SelectValue placeholder="Skip" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ignore">Skip</SelectItem>
        <SelectItem value="create">Create new…</SelectItem>
        {available.map((a) => (
          <SelectItem key={a.id} value={`existing:${a.id}`}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AccountLinkTable({
  lmAccounts,
  wfAccounts,
  draft,
  savedMapping,
  balanceSyncStatus,
  onDraftChange,
}: AccountLinkTableProps) {
  const grouped = lmAccounts
    .filter((a) => a.type === "cash")
    .reduce<Record<string, LunchmoneyAccount[]>>((acc, a) => {
      const key = a.institution_name || "Other";
      (acc[key] ??= []).push(a);
      return acc;
    }, {});

  return (
    <div className="mt-4 space-y-6">
      {Object.entries(grouped).map(([institution, rows]) => (
        <div key={institution}>
          <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
            {institution}
          </h3>
          <div className="divide-y overflow-hidden rounded-md border">
            {rows.map((acc) => {
              const entry = draft[acc.id];
              const isLinked = entry?.type === "existing" || entry?.type === "create";
              const balance = parseFloat(acc.balance).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });
              const meta = [acc.type, acc.subtype, acc.currency.toUpperCase()]
                .filter(Boolean)
                .join(" · ");

              return (
                <div
                  key={acc.id}
                  className={
                    isLinked
                      ? "flex items-center gap-3 bg-green-50 px-4 py-3 dark:bg-green-950/20"
                      : "flex items-center gap-3 border-dashed px-4 py-3"
                  }
                >
                  {isLinked ? (
                    <Icons.CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
                  ) : (
                    <Icons.Circle className="text-muted-foreground/40 h-5 w-5 shrink-0" />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{acc.display_name || acc.name}</p>
                    <p className="text-muted-foreground truncate text-xs capitalize">
                      {meta} · {balance}
                    </p>
                  </div>

                  <Icons.ArrowRight className="text-muted-foreground h-4 w-4 shrink-0" />

                  <WfAccountSelect
                    lmId={acc.id}
                    wfAccounts={wfAccounts}
                    draft={draft}
                    onDraftChange={onDraftChange}
                  />

                  <div className="w-5 shrink-0">
                    {savedMapping[acc.id]?.type === "existing" && (
                      <SyncStatusIcon status={balanceSyncStatus[acc.id]} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
