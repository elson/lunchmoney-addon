import React from "react";
import type { Account } from "@wealthfolio/addon-sdk";
import {
  Badge,
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
import { formatMoney } from "../lib/format";

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
      // Importing into an account in another currency would corrupt its balance.
      a.currency.toUpperCase() === lm.currency.toUpperCase() &&
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

// ─── Balances ────────────────────────────────────────────────────────────────

/** Shared by the header and every row so the columns line up across groups. */
const GRID =
  "grid grid-cols-[1.25rem_minmax(0,1fr)_7rem_1rem_minmax(0,1fr)_9rem] items-center gap-x-3";

function LmBalance({ row }: { row: AccountRowVM }) {
  return (
    <span
      role="group"
      aria-label={`Lunch Money balance for ${row.lm.display_name ?? row.lm.name}`}
      className={cn(
        "text-right text-sm font-medium tabular-nums",
        !row.isLinked && "text-muted-foreground",
      )}
    >
      {formatMoney(row.lmBalance, row.lm.currency)}
    </span>
  );
}

function WfBalance({ row }: { row: AccountRowVM }) {
  const { lm, entry, wfBalance, balanceDelta, balancesMatch } = row;
  const label = `Wealthfolio balance for ${lm.display_name ?? lm.name}`;

  if (entry.type === "ignore") return <span />;

  if (entry.type === "create") {
    return (
      <span role="group" aria-label={label} className="text-right">
        <Badge variant="secondary">New account</Badge>
      </span>
    );
  }

  if (wfBalance === null || balanceDelta === null) {
    return (
      <span
        role="group"
        aria-label={label}
        title="No balance in Wealthfolio yet"
        className="text-muted-foreground text-right text-sm"
      >
        —
      </span>
    );
  }

  const difference = formatMoney(Math.abs(balanceDelta), lm.currency);
  const direction = balanceDelta > 0 ? "higher" : "lower";

  return (
    <span role="group" aria-label={label} className="grid justify-items-end gap-1">
      <span className="text-sm font-medium tabular-nums">
        {formatMoney(wfBalance, lm.currency)}
      </span>
      {balancesMatch ? (
        <Badge variant="success-subtle" className="gap-1">
          <Icons.Check className="h-3 w-3" />
          In sync
        </Badge>
      ) : (
        <Badge
          variant="warning-subtle"
          className="gap-1 tabular-nums"
          title={`Wealthfolio is ${difference} ${direction} than Lunch Money. Sync to update it.`}
        >
          <Icons.AlertTriangle className="h-3 w-3" />
          {difference} {direction}
        </Badge>
      )}
    </span>
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
    <div className={cn(GRID, "p-4")}>
      <span role="img" aria-label={status} title={status}>
        {row.isLinked ? (
          <Icons.CheckCircle className="text-success h-5 w-5" />
        ) : (
          <Icons.Circle className="text-muted-foreground/40 h-5 w-5" />
        )}
      </span>

      <LmAccountInfo acc={row.lm} isLinked={row.isLinked} />
      <LmBalance row={row} />

      <Icons.ArrowRight className="text-muted-foreground h-4 w-4" />

      <WfTarget
        row={row}
        wfAccounts={vm.wfAccounts}
        claimedWfIds={vm.claimedWfIds}
        onDraftChange={onDraftChange}
        onNavigate={onNavigate}
      />

      <WfBalance row={row} />
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
      {/* Column labels; the border matches the cards' so the columns line up. */}
      <div
        className={cn(
          GRID,
          "text-muted-foreground border border-transparent px-4 text-xs font-semibold",
        )}
      >
        <span data-column className="col-span-2">
          Lunch Money
        </span>
        <span />
        <span />
        <span data-column className="px-2">
          Wealthfolio
        </span>
        <span />
      </div>
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
