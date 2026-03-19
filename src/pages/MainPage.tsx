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

  const { status, error, lastSynced, busy, actions } = useAccountSync(ctx, false);

  const tableVm = useMemo(
    () => (status.phase === "ready" ? status.vm.filtered(search, filterTab) : null),
    [status, search, filterTab],
  );

  // Re-render the "X ago" label every minute
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const linkedCount = status.phase === "ready" ? status.vm.linkedCount : 0;
  const isDirty = status.phase === "ready" && status.vm.isDirty;

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
                onClick={actions.syncBalances}
                disabled={busy.syncing || busy.refreshing}
              >
                {busy.syncing ? (
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
              onClick={actions.refresh}
              disabled={
                busy.refreshing || status.phase === "no-api-key" || status.phase === "checking"
              }
            >
              {busy.refreshing ? (
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

        {status.phase === "checking" && <p className="text-muted-foreground text-sm">Loading…</p>}

        {status.phase === "no-api-key" && (
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

        {status.phase === "empty" && (
          <p className="text-muted-foreground text-sm">No accounts found.</p>
        )}

        {status.phase === "ready" && tableVm && (
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
                onDraftChange={actions.changeDraft}
                onNavigate={(path) => ctx.api.navigation.navigate(path)}
              />
            )}

            {isDirty && (
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={actions.undo} disabled={busy.saving}>
                  Undo
                </Button>
                <Button onClick={() => setShowConfirm(true)} disabled={busy.saving}>
                  {busy.saving ? (
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
              vm={status.vm}
              onConfirm={async () => {
                setShowConfirm(false);
                await actions.confirm();
              }}
              onCancel={() => setShowConfirm(false)}
            />
          </>
        )}
      </PageContent>
    </Page>
  );
}
