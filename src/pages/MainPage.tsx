import React, { useState, useEffect, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import type { AddonContext } from "@wealthfolio/addon-sdk";
import {
  Icons,
  Button,
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Page,
  PageHeader,
  PageContent,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Separator,
  ToggleGroup,
  ToggleGroupItem,
} from "@wealthfolio/ui";
import { AccountLinkTable, ConfirmSaveDialog, LinkWizard } from "../components";
import { useAccountSync } from "../hooks";
import { SETTINGS_ROUTE } from "../lib/routes";

export function MainPage({ ctx }: { ctx: AddonContext }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "linked" | "skipped">("all");

  const [mode, setMode] = useState<"table" | "wizard">("table");

  const { status, error, lastSynced, lastSyncResult, busy, actions } = useAccountSync(ctx, false);
  const canSync = status.phase === "ready" || status.phase === "empty";

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
            {lastSynced && (
              <span className="text-muted-foreground mr-1 text-xs">
                {syncStatusText(lastSynced, lastSyncResult)}
              </span>
            )}
            {status.phase === "ready" && mode === "table" && (
              <Button variant="outline" size="sm" onClick={() => setMode("wizard")}>
                <Icons.Link className="h-4 w-4" />
                Link accounts
              </Button>
            )}
            {canSync && mode === "table" && (
              <Button
                size="sm"
                onClick={actions.sync}
                disabled={busy.syncing}
                title="Fetch from Lunch Money and import any balances that changed"
              >
                {busy.syncing ? (
                  <>
                    <Icons.Spinner className="h-4 w-4 animate-spin" />
                    Syncing…
                  </>
                ) : (
                  <>
                    <Icons.RefreshCw className="h-4 w-4" />
                    Sync
                  </>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              title="Settings"
              onClick={() => ctx.api.navigation.navigate(SETTINGS_ROUTE.path)}
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
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icons.Settings />
              </EmptyMedia>
              <EmptyTitle>No API key set</EmptyTitle>
              <EmptyDescription>Add your Lunch Money access token to get started</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => ctx.api.navigation.navigate(SETTINGS_ROUTE.path)}>
                Get started
              </Button>
            </EmptyContent>
          </Empty>
        )}

        {status.phase === "empty" && (
          <p className="text-muted-foreground text-sm">No accounts found.</p>
        )}

        {status.phase === "ready" && mode === "wizard" && (
          <LinkWizard
            vm={status.vm}
            saving={busy.saving}
            onChoose={actions.changeDraft}
            onCancel={() => {
              actions.undo();
              setMode("table");
            }}
            onFinish={async (options) => {
              await actions.confirm(options);
              setMode("table");
            }}
          />
        )}

        {status.phase === "ready" && mode === "table" && tableVm && (
          <>
            {linkedCount === 0 && (
              <Card className="mb-2">
                <CardHeader>
                  <CardTitle>Link your accounts</CardTitle>
                  <CardDescription>
                    Found {status.vm.rows.length} Lunch Money{" "}
                    {status.vm.rows.length === 1 ? "account" : "accounts"}. Step through them one at
                    a time to choose where each balance goes in Wealthfolio — you’ll review
                    everything before it’s saved.
                  </CardDescription>
                  <CardAction>
                    <Button onClick={() => setMode("wizard")}>Start</Button>
                  </CardAction>
                </CardHeader>
              </Card>
            )}
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
                value={[filterTab]}
                onValueChange={(vals) => {
                  // Base UI emits [] when the pressed tab is clicked again; keep it selected.
                  const [val] = vals;
                  if (val) setFilterTab(val as "all" | "linked" | "skipped");
                }}
                className="bg-muted ml-auto h-9 rounded-md p-1"
              >
                {(["all", "linked", "skipped"] as const).map((tab) => (
                  <ToggleGroupItem
                    key={tab}
                    value={tab}
                    className="aria-pressed:bg-background h-7 rounded px-3 text-xs capitalize"
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

function syncStatusText(lastSynced: Date, result: { imported: number } | null): string {
  const when = `Synced ${formatDistanceToNow(lastSynced, { addSuffix: true })}`;
  if (!result) return when;
  if (result.imported === 0) return `${when} · all balances up to date`;
  return `${when} · ${result.imported} ${result.imported === 1 ? "balance" : "balances"} updated`;
}
