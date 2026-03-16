import React from "react";
import type { Account } from "@wealthfolio/addon-sdk";
import {
  Icons,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@wealthfolio/ui";
import type { LunchmoneyAccount } from "../lib/lunchmoney";
import type { AccountMapping, MappingEntry } from "../types";
import { claimedWfIds } from "../lib/mapping";

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
  wfCashBalances: Record<string, number>;
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
  wfCashBalances,
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

              const savedEntry = savedMapping[acc.id];
              const lmBalance = parseFloat(acc.balance);
              const wfBalance =
                savedEntry?.type === "existing" && savedEntry.wfAccountId in wfCashBalances
                  ? wfCashBalances[savedEntry.wfAccountId]
                  : null;
              const balancesMatch = wfBalance !== null && Math.abs(wfBalance - lmBalance) < 0.005;
              const diff = wfBalance !== null ? wfBalance - lmBalance : null;

              return (
                <div
                  key={acc.id}
                  className={
                    isLinked
                      ? "flex items-center gap-3 bg-green-50 p-4 dark:bg-green-950/20"
                      : "flex items-center gap-3 border-dashed p-4"
                  }
                >
                  {isLinked ? (
                    <Icons.CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
                  ) : (
                    <Icons.Circle className="text-muted-foreground/40 h-5 w-5 shrink-0" />
                  )}

                  <div className="grid min-w-0 flex-1 gap-1">
                    <p
                      className={cn(
                        "truncate text-base font-semibold",
                        !isLinked && "text-muted-foreground",
                      )}
                    >
                      {acc.name}
                    </p>
                    <p className="text-muted-foreground flex items-center gap-1.5 text-sm capitalize">
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

                  <div className="ml-auto flex items-center gap-2">
                    {wfBalance !== null && (
                      <div className="flex items-center gap-1.5">
                        {!balancesMatch && (
                          <Icons.AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                        )}
                        <div className="grid text-right">
                          <span
                            className={cn(
                              "text-sm font-medium tabular-nums",
                              balancesMatch ? "text-green-600" : "text-foreground",
                            )}
                          >
                            {wfBalance.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          {!balancesMatch && diff !== null && (
                            <span className="text-xs text-red-500 tabular-nums">
                              {diff > 0 ? "+" : ""}
                              {diff.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          )}
                        </div>
                      </div>
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
