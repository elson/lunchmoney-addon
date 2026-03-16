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
    isDirty,
    lastSynced,
    isSyncingBalances,
    wfCashBalances,
    handleRefresh,
    handleDraftChange,
    handleUndo,
    handleConfirm,
    handleSyncBalances,
  } = useAccountSync(ctx, false);

  const linkedCount = Object.values(savedMapping).filter((e) => e.type === "existing").length;

  const filteredAccounts = useMemo(() => {
    if (!lmAccounts) return [];
    const query = search.trim().toLowerCase();
    return lmAccounts.filter((acc) => {
      if (query) {
        const haystack = [acc.name, acc.display_name ?? "", acc.institution_name ?? ""]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (filterTab === "linked") {
        return draft[acc.id]?.type === "existing" || draft[acc.id]?.type === "create";
      }
      if (filterTab === "skipped") {
        return !draft[acc.id] || draft[acc.id]?.type === "ignore";
      }
      return true;
    });
  }, [lmAccounts, search, filterTab, draft]);

  // Re-render the "X ago" label every minute
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Page>
      <PageHeader
        heading="Lunch Money Add-on"
        text="Synchronise your Lunch Money cash balances to Wealthfolio"
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
                Update Cash Holdings
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              title="Refresh Lunch Money balances"
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

        {!hasApiKey && (
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

        {lmAccounts && lmAccounts.length > 0 && wfAccounts && (
          <div>
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
              {/* <Input
                  className="h-8 max-w-sm"
                  placeholder="Search accounts…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                /> */}
              <ToggleGroup
                type="single"
                value={filterTab}
                onValueChange={(val) => {
                  if (val) setFilterTab(val as "all" | "linked" | "skipped");
                }}
                className="bg-muted ml-auto h-9 rounded-md p-1"
              >
                <ToggleGroupItem
                  value="all"
                  className="data-[state=on]:bg-background h-7 rounded px-3 text-xs"
                >
                  All
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="linked"
                  className="data-[state=on]:bg-background h-7 rounded px-3 text-xs"
                >
                  Linked
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="skipped"
                  className="data-[state=on]:bg-background h-7 rounded px-3 text-xs"
                >
                  Skipped
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {filteredAccounts.length === 0 && (
              <p className="text-muted-foreground mt-6 text-center text-sm">
                No accounts match your search.
              </p>
            )}

            {filteredAccounts.length > 0 && (
              <AccountLinkTable
                lmAccounts={filteredAccounts}
                wfAccounts={wfAccounts}
                draft={draft}
                savedMapping={savedMapping}
                wfCashBalances={wfCashBalances}
                onDraftChange={handleDraftChange}
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
              draft={draft}
              savedMapping={savedMapping}
              lmAccounts={lmAccounts}
              wfAccounts={wfAccounts}
              onConfirm={async () => {
                setShowConfirm(false);
                await handleConfirm();
              }}
              onCancel={() => setShowConfirm(false)}
            />
          </div>
        )}
      </PageContent>
    </Page>
  );
}
