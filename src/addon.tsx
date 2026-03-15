import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { AddonContext } from '@wealthfolio/addon-sdk';
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
} from '@wealthfolio/ui';
import { SettingsPage } from './pages';
import { AccountLinkTable, ConfirmSaveDialog } from './components';
import { useAccountSync } from './hooks';

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
    handleRefresh,
    handleDraftChange,
    handleUndo,
    handleConfirm,
  } = useAccountSync(ctx, false);

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
                <span className="text-xs text-muted-foreground mr-1">
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => ctx.api.navigation.navigate('/addon/lunch-money/settings')}
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
        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

        {!hasApiKey && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Button onClick={() => ctx.api.navigation.navigate('/addon/lunch-money/settings')}>Get started</Button>
            <p className="text-sm text-muted-foreground">
              Add your Lunch Money access token to get started
            </p>
          </div>
        )}

        {hasApiKey && lmAccounts?.length === 0 && (
          <p className="text-sm text-muted-foreground">No accounts found.</p>
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
              <div className="mt-4 flex gap-2 justify-end">
                <Button variant="outline" onClick={handleUndo} disabled={isSaving}>
                  Undo
                </Button>
                <Button onClick={() => setShowConfirm(true)} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Icons.Loader className="h-4 w-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Save'
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

  const SettingsWrapper = () => <SettingsPage ctx={ctx} />;
  ctx.router.add({
    path: '/addon/lunch-money/settings',
    component: React.lazy(() => Promise.resolve({ default: SettingsWrapper })),
  });

  ctx.onDisable(() => {
    try {
      sidebarItem.remove();
    } catch (err) {
      ctx.api.logger.error('Failed to remove sidebar item:');
    }
  });
}
