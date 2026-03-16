import React, { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import type { AddonContext } from "@wealthfolio/addon-sdk";
import {
  Icons,
  Button,
  Page,
  PageHeader,
  PageContent,
  EmptyPlaceholder,
  Separator,
} from "@wealthfolio/ui";
import { AccountLinkTable, ConfirmSaveDialog } from "../components";
import { useAccountSync } from "../hooks";

export function MainPage({ ctx }: { ctx: AddonContext }) {
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
    wfCashBalances,
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
          <>
            <AccountLinkTable
              lmAccounts={lmAccounts}
              wfAccounts={wfAccounts}
              draft={draft}
              savedMapping={savedMapping}
              wfCashBalances={wfCashBalances}
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
          </>
        )}
      </PageContent>
    </Page>
  );
}
