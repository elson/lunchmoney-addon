/* eslint-disable react-refresh/only-export-components */
import React, { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import type { AddonContext } from "@wealthfolio/addon-sdk";
import {
  Icons,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Page,
  PageHeader,
  PageContent,
  EmptyPlaceholder,
} from "@wealthfolio/ui";
import { SettingsPage } from "./pages";
import { AccountLinkTable, ConfirmSaveDialog } from "./components";
import { useAccountSync } from "./hooks";

function AddonMain({ ctx }: { ctx: AddonContext }) {
  const [showConfirm, setShowConfirm] = useState(false);

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
    balanceSyncStatus,
    handleRefresh,
    handleDraftChange,
    handleUndo,
    handleConfirm,
    handleSyncBalances,
  } = useAccountSync(ctx, false);

  const linkedCount = Object.values(savedMapping).filter((e) => e.type === "existing").length;

  // Re-render the "X ago" label every minute
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Page>
      <PageHeader
        heading="Lunch Money Addon"
        actions={
          <TooltipProvider>
            <>
              {lastSynced && (
                <span className="text-muted-foreground mr-1 text-xs">
                  Last synced {formatDistanceToNow(lastSynced, { addSuffix: true })}
                </span>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleRefresh}
                    disabled={loading || !hasApiKey}
                  >
                    {loading ? (
                      <Icons.Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icons.Refresh className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh Lunch Money accounts</TooltipContent>
              </Tooltip>
              {linkedCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSyncBalances}
                      disabled={isSyncingBalances || loading}
                    >
                      {isSyncingBalances ? (
                        <>
                          <Icons.Loader className="mr-2 h-4 w-4 animate-spin" />
                          Syncing…
                        </>
                      ) : (
                        "Sync balances"
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Push Lunch Money balances to Wealthfolio</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => ctx.api.navigation.navigate("/addon/lunch-money/settings")}
                  >
                    <Icons.Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Settings</TooltipContent>
              </Tooltip>
            </>
          </TooltipProvider>
        }
      />

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
          <>
            <AccountLinkTable
              lmAccounts={lmAccounts}
              wfAccounts={wfAccounts}
              draft={draft}
              savedMapping={savedMapping}
              balanceSyncStatus={balanceSyncStatus}
              onDraftChange={handleDraftChange}
            />

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
                    "Save"
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
          </>
        )}
      </PageContent>
    </Page>
  );
}

export default function enable(ctx: AddonContext) {
  const sidebarItem = ctx.sidebar.addItem({
    id: "lunch-money",
    label: "Lunch Money",
    icon: <Icons.Blocks className="h-5 w-5" />,
    route: "/addon/lunch-money",
    order: 100,
  });

  const Wrapper = () => <AddonMain ctx={ctx} />;
  ctx.router.add({
    path: "/addon/lunch-money",
    component: React.lazy(() => Promise.resolve({ default: Wrapper })),
  });

  const SettingsWrapper = () => <SettingsPage ctx={ctx} />;
  ctx.router.add({
    path: "/addon/lunch-money/settings",
    component: React.lazy(() => Promise.resolve({ default: SettingsWrapper })),
  });

  ctx.onDisable(() => {
    try {
      sidebarItem.remove();
    } catch {
      ctx.api.logger.error("Failed to remove sidebar item:");
    }
  });
}
