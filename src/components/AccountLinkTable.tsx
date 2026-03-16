import React from "react";
import type { Account } from "@wealthfolio/addon-sdk";
import {
  Icons,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from "@wealthfolio/ui";
import type { LunchmoneyAccount } from "../lib/lunchmoney";
import type { AccountMapping, MappingEntry } from "../types";
import { claimedWfIds } from "../lib/mapping";

// ─── LM account info column ──────────────────────────────────────────────────

interface LmAccountInfoProps {
  acc: LunchmoneyAccount;
  isLinked: boolean;
}

function LmAccountInfo({ acc, isLinked }: LmAccountInfoProps) {
  const meta = [acc.type, acc.subtype, acc.currency.toUpperCase()].filter(Boolean).join(" · ");

  return (
    <div className="grid min-w-0 gap-1">
      <p className={cn("truncate font-semibold", !isLinked && "text-muted-foreground")}>
        {acc.display_name ?? acc.name}
        {acc.display_name && (
          <span className="text-muted-foreground ml-1.5 text-xs font-normal">({acc.name})</span>
        )}
      </p>
      <p className="text-muted-foreground flex items-center gap-1.5 text-sm capitalize">{meta}</p>
    </div>
  );
}

// ─── WF account info column ───────────────────────────────────────────────────

interface WfAccountInfoProps {
  entry: MappingEntry | undefined;
  wfAccount: Account | undefined;
}

function WfAccountInfo({ entry, wfAccount }: WfAccountInfoProps) {
  const resolved = entry ?? { type: "ignore" as const };

  if (resolved.type === "ignore") {
    return (
      <div className="grid min-w-0 gap-1">
        <p className="text-muted-foreground truncate font-semibold">Skip</p>
      </div>
    );
  }

  if (resolved.type === "create") {
    return (
      <div className="grid min-w-0 gap-1">
        <p className="text-muted-foreground truncate font-semibold">Create new account</p>
        <p className="text-muted-foreground text-sm">Will be created on save</p>
      </div>
    );
  }

  if (!wfAccount) {
    return (
      <div className="grid min-w-0 gap-1">
        <p className="text-muted-foreground truncate font-semibold">Unknown account</p>
      </div>
    );
  }

  const meta = [wfAccount.accountType.toLowerCase(), wfAccount.currency, wfAccount.group]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="grid min-w-0 gap-1">
      <p className="truncate font-semibold">{wfAccount.name}</p>
      <p className="text-muted-foreground flex items-center gap-1.5 text-sm">{meta}</p>
    </div>
  );
}

// ─── WF account menu button ───────────────────────────────────────────────────

interface WfAccountMenuButtonProps {
  lmId: number;
  wfAccounts: Account[];
  draft: AccountMapping;
  onDraftChange: (lmId: number, entry: MappingEntry) => void;
}

function WfAccountMenuButton({ lmId, wfAccounts, draft, onDraftChange }: WfAccountMenuButtonProps) {
  const claimed = claimedWfIds(draft);
  const currentEntry: MappingEntry = draft[lmId] ?? { type: "ignore" };
  const currentWfId = currentEntry.type === "existing" ? currentEntry.wfAccountId : null;
  const available = wfAccounts.filter(
    (a) =>
      a.trackingMode === "HOLDINGS" && String(a.id) !== currentWfId && !claimed.has(String(a.id)),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <Icons.ChevronsUpDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onDraftChange(lmId, { type: "ignore" })}>
          Skip
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onDraftChange(lmId, { type: "create" })}>
          Create new account…
        </DropdownMenuItem>
        {available.length > 0 && <DropdownMenuSeparator />}
        {available.map((a) => (
          <DropdownMenuItem
            key={a.id}
            className="flex flex-col items-start"
            onSelect={() => onDraftChange(lmId, { type: "existing", wfAccountId: String(a.id) })}
          >
            <span>{a.name}</span>
            {a.group && <span className="text-muted-foreground text-xs">{a.group}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Balance indicator ────────────────────────────────────────────────────────

interface BalanceIndicatorProps {
  wfBalance: number | null;
  lmBalance: number;
}

function BalanceIndicator({ wfBalance, lmBalance }: BalanceIndicatorProps) {
  if (wfBalance === null)
    return (
      <div className="w-[140px] shrink-0 text-right">
        <span className="text-muted-foreground/40 text-sm tabular-nums">--,--.--</span>
      </div>
    );

  const balancesMatch = Math.abs(wfBalance - lmBalance) < 0.005;
  const diff = wfBalance - lmBalance;

  return (
    <div className="flex w-[140px] shrink-0 items-center gap-2">
      {/* always reserve icon space so the number column stays aligned */}
      <div className="flex h-4 w-4 shrink-0 items-center justify-center">
        {!balancesMatch && <Icons.AlertTriangle className="h-4 w-4 text-red-500" />}
      </div>
      <div className="grid min-w-0 flex-1 text-right">
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
        {!balancesMatch && (
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
  );
}

// ─── Main table ───────────────────────────────────────────────────────────────

interface AccountLinkTableProps {
  lmAccounts: LunchmoneyAccount[];
  wfAccounts: Account[];
  draft: AccountMapping;
  savedMapping: AccountMapping;
  wfCashBalances: Record<string, number>;
  onDraftChange: (lmId: number, entry: MappingEntry) => void;
}

export function AccountLinkTable({
  lmAccounts,
  wfAccounts,
  draft,
  savedMapping,
  wfCashBalances,
  onDraftChange,
}: AccountLinkTableProps) {
  const grouped = lmAccounts.reduce<Record<string, LunchmoneyAccount[]>>((acc, a) => {
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
          <div className="bg-card divide-y overflow-hidden rounded-md border">
            {rows.map((acc) => {
              const entry = draft[acc.id];
              const isLinked = entry?.type === "existing" || entry?.type === "create";

              const savedEntry = savedMapping[acc.id];
              const wfAccount =
                entry?.type === "existing"
                  ? wfAccounts.find((w) => String(w.id) === entry.wfAccountId)
                  : undefined;

              const lmBalance = parseFloat(acc.balance);
              const wfBalance =
                savedEntry?.type === "existing" && savedEntry.wfAccountId in wfCashBalances
                  ? wfCashBalances[savedEntry.wfAccountId]
                  : null;

              return (
                <div key={acc.id} className="flex items-center gap-3 p-4">
                  {/* Status icon */}
                  {isLinked ? (
                    <Icons.CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
                  ) : (
                    <Icons.Circle className="text-muted-foreground/40 h-5 w-5 shrink-0" />
                  )}

                  {/* LM account details */}
                  <div className="min-w-0 flex-1">
                    <LmAccountInfo acc={acc} isLinked={isLinked} />
                  </div>

                  <Icons.ArrowRight className="text-muted-foreground h-4 w-4 shrink-0" />

                  {/* WF account details */}
                  <div className="min-w-0 flex-1">
                    <WfAccountInfo entry={entry} wfAccount={wfAccount} />
                  </div>

                  {/* Menu button to change WF account */}
                  <WfAccountMenuButton
                    lmId={acc.id}
                    wfAccounts={wfAccounts}
                    draft={draft}
                    onDraftChange={onDraftChange}
                  />

                  {/* Balance indicator */}
                  <BalanceIndicator wfBalance={wfBalance} lmBalance={lmBalance} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
