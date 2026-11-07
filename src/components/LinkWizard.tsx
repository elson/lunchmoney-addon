import React, { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Checkbox,
  Icons,
  Label,
  Progress,
  cn,
} from "@wealthfolio/ui";
import type { AccountRowVM, AccountViewModel, LinkCandidate } from "../lib/accountViewModel";
import type { LunchmoneyAccount } from "../lib/lunchmoney";
import { formatMoney } from "../lib/format";
import type { MappingEntry } from "../types";
import { ChangeSummary } from "./ChangeSummary";

export interface LinkWizardProps {
  /** The full (unfiltered) view model; it reflects the draft as choices are made. */
  vm: AccountViewModel;
  saving: boolean;
  onChoose: (lmId: number, entry: MappingEntry) => void;
  onCancel: () => void;
  onFinish: (options: { importBalances: boolean }) => Promise<void>;
}

const lmName = (lm: LunchmoneyAccount) => lm.display_name ?? lm.name;

/**
 * Steps through every Lunch Money account, asking where its balance should go
 * in Wealthfolio, then reviews everything that will happen before saving.
 */
export function LinkWizard({ vm, saving, onChoose, onCancel, onFinish }: LinkWizardProps) {
  // Same order as the table: grouped by institution.
  const steps = useMemo(() => vm.groups.flatMap((g) => g.rows), [vm.groups]);
  const [index, setIndex] = useState(0);
  const reviewing = index >= steps.length;

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-2">
      <div className="flex items-center gap-4">
        <span className="text-muted-foreground shrink-0 text-sm">
          {reviewing ? "Review" : `Account ${index + 1} of ${steps.length}`}
        </span>
        <Progress
          value={Math.round((Math.min(index + 1, steps.length) / steps.length) * 100)}
          className="flex-1"
        />
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {reviewing ? (
        <ReviewStep
          vm={vm}
          saving={saving}
          onBack={() => setIndex(steps.length - 1)}
          onFinish={onFinish}
        />
      ) : (
        <AccountStep
          key={steps[index].lm.id}
          row={steps[index]}
          candidates={vm.candidatesFor(steps[index].lm.id)}
          defaultChoice={vm.defaultChoiceFor(steps[index].lm.id)}
          isLast={index === steps.length - 1}
          onChoose={onChoose}
          onBack={index > 0 ? () => setIndex(index - 1) : undefined}
          onNext={() => setIndex(index + 1)}
        />
      )}
    </div>
  );
}

// ─── One Lunch Money account ─────────────────────────────────────────────────

interface AccountStepProps {
  row: AccountRowVM;
  candidates: readonly LinkCandidate[];
  /** Applied when this account has no choice yet. */
  defaultChoice: MappingEntry;
  isLast: boolean;
  onChoose: (lmId: number, entry: MappingEntry) => void;
  onBack?: () => void;
  onNext: () => void;
}

function AccountStep({
  row,
  candidates,
  defaultChoice,
  isLast,
  onChoose,
  onBack,
  onNext,
}: AccountStepProps) {
  const { lm, entry } = row;
  // Start a new account on the suggested choice; never override one already made.
  useEffect(() => {
    if (!row.hasChoice) onChoose(lm.id, defaultChoice);
  }, [lm.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = lmName(lm);
  const currency = lm.currency.toUpperCase();
  const meta = [lm.institution_name, lm.type, lm.subtype].filter(Boolean).join(" · ");
  const choose = (e: MappingEntry) => onChoose(lm.id, e);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Lunch Money
            </p>
            <h2 className="truncate text-lg leading-tight font-semibold">{name}</h2>
            <CardDescription className="capitalize">{meta}</CardDescription>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(row.lmBalance, lm.currency)}
            </p>
            <p className="text-muted-foreground text-xs">Lunch Money balance</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium">Where should this balance go in Wealthfolio?</p>
        <div
          role="radiogroup"
          aria-label={`Wealthfolio account for ${name}`}
          className="grid gap-2"
        >
          {candidates.map((c) => (
            <Option
              key={c.account.id}
              checked={entry.type === "existing" && entry.wfAccountId === String(c.account.id)}
              // Importing into an account in another currency would corrupt its balance.
              disabled={!c.currencyMatches}
              onSelect={() => choose({ type: "existing", wfAccountId: String(c.account.id) })}
              icon={<Icons.Wallet className="h-4 w-4" />}
              title={c.account.name}
              description={[c.account.group, c.account.currency].filter(Boolean).join(" · ")}
              badges={
                <>
                  {c.suggested && <Badge variant="info-subtle">Suggested</Badge>}
                  {c.balanceMatches && <Badge variant="success-subtle">Balance matches</Badge>}
                  {!c.currencyMatches && (
                    <Badge variant="warning-subtle">
                      Different currency ({c.account.currency})
                    </Badge>
                  )}
                </>
              }
              aside={
                c.balance === null ? (
                  <span className="text-muted-foreground text-xs">No balance yet</span>
                ) : (
                  <span className="text-sm tabular-nums">
                    {formatMoney(c.balance, c.account.currency)}
                  </span>
                )
              }
            />
          ))}
          <Option
            checked={entry.type === "create"}
            onSelect={() => choose({ type: "create" })}
            icon={<Icons.Plus className="h-4 w-4" />}
            title="Create a new Wealthfolio account"
            description={
              lm.institution_name
                ? `Cash account in ${currency}, grouped under ${lm.institution_name}`
                : `Cash account in ${currency}`
            }
          />
          <Option
            checked={entry.type === "ignore"}
            onSelect={() => choose({ type: "ignore" })}
            icon={<Icons.Close className="h-4 w-4" />}
            title="Skip"
            description="Don't sync this account"
          />
        </div>
        {/* Sticky so Back/Next stay reachable when there are many accounts to choose from. */}
        <div className="bg-card sticky bottom-0 flex justify-between border-t py-4">
          <Button variant="outline" onClick={onBack} disabled={!onBack}>
            Back
          </Button>
          <Button onClick={onNext}>{isLast ? "Review changes" : "Next"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface OptionProps {
  checked: boolean;
  disabled?: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description?: string;
  badges?: React.ReactNode;
  aside?: React.ReactNode;
}

function Option({
  checked,
  disabled = false,
  onSelect,
  icon,
  title,
  description,
  badges,
  aside,
}: OptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors",
        checked && "border-foreground bg-muted",
        !checked && !disabled && "hover:bg-muted",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          checked ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
        )}
      >
        {checked ? <Icons.Check className="h-4 w-4" /> : icon}
      </span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{title}</span>
          {badges}
        </span>
        {description && <span className="text-muted-foreground text-sm">{description}</span>}
      </span>
      {aside && <span className="shrink-0 text-right">{aside}</span>}
    </button>
  );
}

// ─── Review ──────────────────────────────────────────────────────────────────

interface ReviewStepProps {
  vm: AccountViewModel;
  saving: boolean;
  onBack: () => void;
  onFinish: (options: { importBalances: boolean }) => Promise<void>;
}

function ReviewStep({ vm, saving, onBack, onFinish }: ReviewStepProps) {
  const { changes, importPlan, skipped } = vm;
  const [importBalances, setImportBalances] = useState(true);
  const willImport = importBalances && importPlan.length > 0;
  const nothingToDo = !changes.hasChanges && !willImport;
  const everythingSkipped = !changes.hasChanges && changes.unchanged.length === 0;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg leading-none font-semibold">Review changes</h2>
        <CardDescription>Nothing is saved until you apply these changes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {everythingSkipped ? (
          <p className="text-muted-foreground text-sm">No changes — every account is skipped.</p>
        ) : (
          <ChangeSummary changes={changes} />
        )}

        {skipped.length > 0 && !everythingSkipped && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Skipped:</p>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
              {skipped.map((lm) => (
                <li key={lm.id}>{lmName(lm)}</li>
              ))}
            </ul>
          </div>
        )}

        {importPlan.length > 0 && (
          <div className="bg-muted space-y-3 rounded-md p-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="import-balances"
                checked={importBalances}
                onCheckedChange={(checked) => setImportBalances(checked === true)}
              />
              <Label htmlFor="import-balances">Import Lunch Money balances now</Label>
            </div>
            <ul
              aria-label="Balances to import"
              className={cn(
                "space-y-1 text-sm tabular-nums",
                importBalances ? "text-foreground" : "text-muted-foreground line-through",
              )}
            >
              {importPlan.map(({ lm, target, from, to }) => (
                <li key={lm.id}>
                  {target
                    ? `${target.name}: ${
                        from === null ? "no balance" : formatMoney(from, target.currency)
                      } → ${formatMoney(to, lm.currency)}`
                    : `${lmName(lm)} (new account): ${formatMoney(to, lm.currency)}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button
            onClick={() => onFinish({ importBalances: willImport })}
            disabled={nothingToDo || saving}
          >
            {saving ? (
              <>
                <Icons.Spinner className="h-4 w-4 animate-spin" />
                Applying…
              </>
            ) : (
              "Apply changes"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
