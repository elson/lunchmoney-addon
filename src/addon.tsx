import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { AddonContext } from '@wealthfolio/addon-sdk';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Icons,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Separator,
} from '@wealthfolio/ui';
import { SettingsPage } from './pages';
import { AccountLinkTable, ConfirmSaveDialog } from './components';
import { useAccountSync } from './hooks';

function AddonMain({ ctx }: { ctx: AddonContext }) {
  const [showSettings, setShowSettings] = useState(false);
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
    handleRefresh,
    handleDraftChange,
    handleUndo,
    handleConfirm,
  } = useAccountSync(ctx, showSettings);

  // Re-render the "X ago" label every minute
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (showSettings) {
    return (
      <div>
        <div className="px-6 pt-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(false)}
          >
            <Icons.ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>
        <SettingsPage ctx={ctx} />
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Lunch Money Accounts</CardTitle>
          <div className="flex items-center gap-3">
            {lastSynced && (
              <span className="text-xs text-muted-foreground">
                Last synced{' '}
                {formatDistanceToNow(lastSynced, { addSuffix: true })}
              </span>
            )}
            <TooltipProvider>
              <div className="flex items-center gap-2">
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowSettings(true)}
                    >
                      <Icons.Settings className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Settings</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        </CardHeader>
        <Separator />
        <CardContent>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

          {!hasApiKey && (
            <p className="mt-6 text-sm text-muted-foreground text-center">
              Add your Lunch Money access token to get started
            </p>
          )}

          {hasApiKey && lmAccounts?.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              No accounts found.
            </p>
          )}

          {lmAccounts && lmAccounts.length > 0 && wfAccounts && (
            <>
              <AccountLinkTable
                lmAccounts={lmAccounts}
                wfAccounts={wfAccounts}
                draft={draft}
                onDraftChange={handleDraftChange}
              />

              {isDirty && (
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={() => setShowConfirm(true)}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Icons.Loader className="h-4 w-4 mr-2 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      'Save changes'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleUndo}
                    disabled={isSaving}
                  >
                    Undo
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
        </CardContent>
      </Card>
    </div>
  );
}

export default function enable(ctx: AddonContext) {
  const sidebarItem = ctx.sidebar.addItem({
    id: 'lunch-money',
    label: 'Lunch Money',
    icon: <Icons.Blocks className="h-5 w-5" />,
    route: '/addon/lunch-money',
    order: 100,
  });

  const Wrapper = () => <AddonMain ctx={ctx} />;
  ctx.router.add({
    path: '/addon/lunch-money',
    component: React.lazy(() => Promise.resolve({ default: Wrapper })),
  });

  ctx.onDisable(() => {
    try {
      sidebarItem.remove();
    } catch (err) {
      ctx.api.logger.error('Failed to remove sidebar item:');
    }
  });
}
