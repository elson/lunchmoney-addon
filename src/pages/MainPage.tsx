import React, { useState, useEffect, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import type { AddonContext } from "@wealthfolio/addon-sdk";
import {
  Icons,
  Button,
  Input,
  Page,
  PageHeader,
  PageContent,
  EmptyPlaceholder,
  Separator,
  ToggleGroup,
  ToggleGroupItem,
} from "@wealthfolio/ui";
import { AccountLinkTable, ConfirmSaveDialog } from "../components";
import { useAccountSync } from "../hooks";
import { buildAccountViewModel } from "../lib/accountViewModel";

export function MainPage({ ctx }: { ctx: AddonContext }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "linked" | "skipped">("all");

  const {
    lmAccounts,
    wfAccounts,
    savedMapping,
    draft,
    loading,
    error,
    hasApiKey,
    isSaving,
    lastSynced,
    isSyncingBalances,
    wfCashBalances,
    handleRefresh,
    handleDraftChange,
    handleUndo,
    handleConfirm,
    handleSyncBalances,
  } = useAccountSync(ctx, false);

  const vm = useMemo(
    () =>
      lmAccounts && wfAccounts
        ? buildAccountViewModel(lmAccounts, wfAccounts, draft, savedMapping, wfCashBalances)
        : null,
    [lmAccounts, wfAccounts, draft, savedMapping, wfCashBalances],
  );

  // Filtered view — rows/groups filtered by search + tab; aggregate state shared from vm
  const tableVm = useMemo(() => vm?.filtered(search, filterTab) ?? null, [vm, search, filterTab]);

  // Re-render the "X ago" label every minute
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const linkedCount = vm?.linkedCount ?? 0;
  const isDirty = vm?.isDirty ?? false;

  return (
    <Page>
      <PageHeader
        heading="Lunch Money Accounts"
        text="Link your Lunch Money and Wealthfolio accounts and import balances"
        actions={
          <>
            {lastSynced && linkedCount > 0 && (
              <span className="text-muted-foreground mr-1 text-xs">
                Last updated {formatDistanceToNow(lastSynced, { addSuffix: true })}
              </span>
            )}
            {linkedCount > 0 && (
              <Button
                size="sm"
                onClick={handleSyncBalances}
                disabled={isSyncingBalances || loading}
              >
                {isSyncingBalances ? (
                  <Icons.Spinner className="h-4 w-4 animate-spin" />
                ) : (
                  <Icons.Import className="h-4 w-4" />
                )}
                Import Balances
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              title="Refresh Lunch Money accounts"
              onClick={handleRefresh}
              disabled={loading || !hasApiKey}
            >
              {loading ? (
                <Icons.Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Icons.Refresh className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              title="Settings"
              onClick={() => ctx.api.navigation.navigate("/addon/lunch-money/settings")}
            >
              <Icons.Settings className="h-4 w-4" />
            </Button>
          </>
        }
      />
      <Separator />
      <PageContent withPadding>
        {error && <p className="text-destructive mb-4 text-sm">{error}</p>}

        {hasApiKey === null && loading && <p className="text-muted-foreground text-sm">Loading…</p>}

        {hasApiKey === false && (
          <EmptyPlaceholder>
            <EmptyPlaceholder.Icon name="Settings" />
            <EmptyPlaceholder.Title>No API key set</EmptyPlaceholder.Title>
            <EmptyPlaceholder.Description>
              Add your Lunch Money access token to get started
            </EmptyPlaceholder.Description>
            <Button onClick={() => ctx.api.navigation.navigate("/addon/lunch-money/settings")}>
              Get started
            </Button>
          </EmptyPlaceholder>
        )}

        {hasApiKey && lmAccounts?.length === 0 && (
          <p className="text-muted-foreground text-sm">No accounts found.</p>
        )}

        {tableVm && vm && lmAccounts && lmAccounts.length > 0 && (
          <>
            <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 sm:max-w-sm">
                <Icons.Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Search accounts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="!h-9 pr-9 pl-9 text-sm"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                    aria-label="Clear search"
                  >
                    <Icons.Close className="h-4 w-4" />
                  </button>
                )}
              </div>
              <ToggleGroup
                type="single"
                value={filterTab}
                onValueChange={(val) => {
                  if (val) setFilterTab(val as "all" | "linked" | "skipped");
                }}
                className="bg-muted ml-auto h-9 rounded-md p-1"
              >
                {(["all", "linked", "skipped"] as const).map((tab) => (
                  <ToggleGroupItem
                    key={tab}
                    value={tab}
                    className="data-[state=on]:bg-background h-7 rounded px-3 text-xs capitalize"
                  >
                    {tab}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {tableVm.rows.length === 0 && (
              <p className="text-muted-foreground mt-6 text-center text-sm">
                No accounts match your search.
              </p>
            )}

            {tableVm.rows.length > 0 && (
              <AccountLinkTable
                vm={tableVm}
                onDraftChange={handleDraftChange}
                onNavigate={(path) => ctx.api.navigation.navigate(path)}
              />
            )}

            {isDirty && (
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={handleUndo} disabled={isSaving}>
                  Undo
                </Button>
                <Button onClick={() => setShowConfirm(true)} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Icons.Loader className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            )}

            <ConfirmSaveDialog
              open={showConfirm}
              vm={vm}
              onConfirm={async () => {
                setShowConfirm(false);
                await handleConfirm();
              }}
              onCancel={() => setShowConfirm(false)}
            />
          </>
        )}
      </PageContent>
    </Page>
  );
}
