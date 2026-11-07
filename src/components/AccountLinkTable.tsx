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
import type { AccountViewModel, AccountRowVM } from "../lib/accountViewModel";
import type { MappingEntry } from "../types";

// ─── Formatting ──────────────────────────────────────────────────────────────

function formatMoney(amount: number, currency: string, signed = false): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      signDisplay: signed ? "exceptZero" : "auto",
    }).format(amount);
  } catch {
    // Unknown currency code — fall back to a plain number with the code.
    const n = amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: signed ? "exceptZero" : "auto",
    });
    return `${n} ${currency.toUpperCase()}`;
  }
}

const SOURCE_LABEL = { manual: "Manual", synced: "Synced" } as const;

// ─── LM account info column ──────────────────────────────────────────────────

interface LmAccountInfoProps {
  acc: LunchmoneyAccount;
  isLinked: boolean;
}

function LmAccountInfo({ acc, isLinked }: LmAccountInfoProps) {
  const meta = [
    acc.type,
    acc.subtype,
    acc.currency.toUpperCase(),
    acc.source && SOURCE_LABEL[acc.source],
  ]
    .filter(Boolean)
    .join(" · ");
  // Only show the original name when the display name doesn't already say it.
  const showOriginalName =
    acc.display_name !== null && !acc.display_name.toLowerCase().includes(acc.name.toLowerCase());

  return (
    <div className="grid min-w-0 gap-1">
      <p className={cn("truncate font-semibold", !isLinked && "text-muted-foreground")}>
        {acc.display_name ?? acc.name}
        {showOriginalName && (
          <span className="text-muted-foreground ml-1.5 text-xs font-normal">({acc.name})</span>
        )}
      </p>
      <p className="text-muted-foreground text-sm capitalize">{meta}</p>
    </div>
  );
}

// ─── WF target column ────────────────────────────────────────────────────────

function wfTargetLabel(entry: MappingEntry, wfAccount: Account | undefined) {
  if (entry.type === "ignore") return { title: "Skip", subtitle: null, muted: true };
  if (entry.type === "create")
    return { title: "Create new account", subtitle: "Will be created on save", muted: true };
  if (!wfAccount) return { title: "Unknown account", subtitle: null, muted: true };
  const subtitle = [wfAccount.accountType.toLowerCase(), wfAccount.currency, wfAccount.group]
    .filter(Boolean)
    .join(" · ");
  return { title: wfAccount.name, subtitle, muted: !wfAccount.isActive };
}

interface WfTargetProps {
  row: AccountRowVM;
  wfAccounts: readonly Account[];
  claimedWfIds: ReadonlySet<string>;
  onDraftChange: (lmId: number, entry: MappingEntry) => void;
  onNavigate: (path: string) => void;
}

/** The whole target cell opens the menu; a linked account also gets an "open" button. */
function WfTarget({ row, wfAccounts, claimedWfIds, onDraftChange, onNavigate }: WfTargetProps) {
  const { lm, entry, wfAccount } = row;
  const label = wfTargetLabel(entry, wfAccount);
  const currentWfId = entry.type === "existing" ? entry.wfAccountId : null;
  const available = wfAccounts.filter(
    (a) =>
      a.trackingMode === "HOLDINGS" &&
      String(a.id) !== currentWfId &&
      !claimedWfIds.has(String(a.id)),
  );
  const lmName = lm.display_name ?? lm.name;

  return (
    <div className="flex min-w-0 items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              aria-label={`Choose Wealthfolio account for ${lmName}`}
              className="h-auto min-w-0 justify-start gap-2 px-2 py-1.5 text-left"
            />
          }
        >
          <span className="grid min-w-0 gap-1">
            <span
              className={cn(
                "truncate",
                label.muted ? "text-muted-foreground font-normal" : "font-semibold",
              )}
            >
              {label.title}
            </span>
            {label.subtitle && (
              <span className="text-muted-foreground truncate text-sm font-normal capitalize">
                {label.subtitle}
              </span>
            )}
          </span>
          <Icons.ChevronsUpDown className="text-muted-foreground h-4 w-4 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onDraftChange(lm.id, { type: "ignore" })}>
            Skip
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDraftChange(lm.id, { type: "create" })}>
            Create new account…
          </DropdownMenuItem>
          {available.length > 0 && <DropdownMenuSeparator />}
          {available.map((a) => (
            <DropdownMenuItem
              key={a.id}
              className="flex flex-col items-start"
              onClick={() => onDraftChange(lm.id, { type: "existing", wfAccountId: String(a.id) })}
            >
              <span>{a.name}</span>
              {a.group && <span className="text-muted-foreground text-xs">{a.group}</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {entry.type === "existing" && wfAccount && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Open ${wfAccount.name} in Wealthfolio`}
          title="Open in Wealthfolio"
          className="h-8 w-8 shrink-0"
          onClick={() => onNavigate(`/accounts/${wfAccount.id}`)}
        >
          <Icons.ExternalLink className="text-muted-foreground h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// ─── Balance column ──────────────────────────────────────────────────────────

function BalanceColumn({ row }: { row: AccountRowVM }) {
  const { lm, lmBalance, wfBalance, balanceDelta, balancesMatch } = row;

  return (
    <div className="grid w-[160px] shrink-0 gap-1 text-right">
      <span className="text-sm font-medium tabular-nums">
        {formatMoney(lmBalance, lm.currency)}
      </span>
      {wfBalance !== null && balancesMatch && (
        <span className="text-success text-xs">Matches Wealthfolio</span>
      )}
      {wfBalance !== null && !balancesMatch && balanceDelta !== null && (
        <span className="text-warning flex items-center justify-end gap-1 text-xs tabular-nums">
          <Icons.AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Wealthfolio {formatMoney(wfBalance, lm.currency)} (
          {formatMoney(balanceDelta, lm.currency, true)})
        </span>
      )}
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface AccountRowProps {
  row: AccountRowVM;
  vm: AccountViewModel;
  onDraftChange: (lmId: number, entry: MappingEntry) => void;
  onNavigate: (path: string) => void;
}

function AccountRow({ row, vm, onDraftChange, onNavigate }: AccountRowProps) {
  const status = row.isLinked ? "Linked" : "Not linked";
  return (
    <div className="flex items-center gap-3 p-4">
      <span role="img" aria-label={status} title={status} className="shrink-0">
        {row.isLinked ? (
          <Icons.CheckCircle className="text-success h-5 w-5" />
        ) : (
          <Icons.Circle className="text-muted-foreground/40 h-5 w-5" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <LmAccountInfo acc={row.lm} isLinked={row.isLinked} />
      </div>

      <Icons.ArrowRight className="text-muted-foreground h-4 w-4 shrink-0" />

      <div className="min-w-0 flex-1">
        <WfTarget
          row={row}
          wfAccounts={vm.wfAccounts}
          claimedWfIds={vm.claimedWfIds}
          onDraftChange={onDraftChange}
          onNavigate={onNavigate}
        />
      </div>

      <BalanceColumn row={row} />
    </div>
  );
}

// ─── Main table ───────────────────────────────────────────────────────────────

interface AccountLinkTableProps {
  vm: AccountViewModel;
  onDraftChange: (lmId: number, entry: MappingEntry) => void;
  onNavigate: (path: string) => void;
}

export function AccountLinkTable({ vm, onDraftChange, onNavigate }: AccountLinkTableProps) {
  return (
    <div className="mt-4 space-y-6">
      {vm.groups.map(({ institution, rows }) => (
        <div key={institution}>
          <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
            {institution}
          </h3>
          <div className="bg-card divide-y overflow-hidden rounded-md border">
            {rows.map((row) => (
              <AccountRow
                key={row.lm.id}
                row={row}
                vm={vm}
                onDraftChange={onDraftChange}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
