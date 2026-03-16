import React from "react";
import type { Account } from "@wealthfolio/addon-sdk";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@wealthfolio/ui";
function LinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function LinkOffIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
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
        <SelectValue placeholder="Ignore" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ignore">Ignore</SelectItem>
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
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="pb-2 font-medium">Lunch Money Account</th>
                <th className="w-6 pb-2"></th>
                <th className="pb-2 pl-2 font-medium">Wealthfolio Account</th>
                <th className="pb-2 pl-4 font-medium">Type</th>
                <th className="pb-2 pl-4 font-medium">Subtype</th>
                <th className="pb-2 pl-4 font-medium">Currency</th>
                <th className="pb-2 text-right font-medium">Balance</th>
                <th className="w-6 pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((acc) => (
                <tr key={acc.id} className="border-b last:border-0">
                  <td className="py-2 pr-4">{acc.display_name || acc.name}</td>
                  <td className="w-6 py-2">
                    {(() => {
                      const entry = draft[acc.id];
                      const isLinked = entry?.type === "existing" || entry?.type === "create";
                      return isLinked ? (
                        <LinkIcon className="h-4 w-4 text-green-500" />
                      ) : (
                        <LinkOffIcon className="h-4 w-4 text-amber-500" />
                      );
                    })()}
                  </td>
                  <td className="py-2 pl-2">
                    <WfAccountSelect
                      lmId={acc.id}
                      wfAccounts={wfAccounts}
                      draft={draft}
                      onDraftChange={onDraftChange}
                    />
                  </td>
                  <td className="text-muted-foreground py-2 pr-4 pl-4 capitalize">{acc.type}</td>
                  <td className="text-muted-foreground py-2 pr-4 pl-4 capitalize">
                    {acc.subtype ?? "—"}
                  </td>
                  <td className="text-muted-foreground py-2 pr-4 pl-4 uppercase">{acc.currency}</td>
                  <td className="py-2 text-right tabular-nums">
                    {parseFloat(acc.balance).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="w-6 py-2 pl-2">
                    {savedMapping[acc.id]?.type === "existing" && (
                      <SyncStatusIcon status={balanceSyncStatus[acc.id]} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
