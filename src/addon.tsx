import React, { useState, useEffect } from 'react';
import type { AddonContext, Account } from '@wealthfolio/addon-sdk';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Icons,
  Button,
} from '@wealthfolio/ui';
import { SettingsPage } from './pages';
import { fetchAllAccounts, type LunchmoneyAccount } from './lib/lunchmoney';
import {
  MAPPING_SECRET_KEY,
  deserializeMapping,
  serializeMapping,
  mappingsEqual,
} from './lib/mapping';
import { AccountLinkTable, ConfirmSaveDialog } from './components';
import type { AccountMapping, MappingEntry } from './types';

function AddonMain({ ctx }: { ctx: AddonContext }) {
  const [showSettings, setShowSettings] = useState(false);
  const [lmAccounts, setLmAccounts] = useState<LunchmoneyAccount[] | null>(null);
  const [wfAccounts, setWfAccounts] = useState<Account[] | null>(null);
  const [savedMapping, setSavedMapping] = useState<AccountMapping>({});
  const [draft, setDraft] = useState<AccountMapping>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (showSettings) return;
    ctx.api.secrets.get('lunchmoney-api-key').then((key) => {
      setHasApiKey(!!key);
      if (key) {
        loadAll(key);
      } else {
        setLmAccounts(null);
        setWfAccounts(null);
      }
    });
  }, [showSettings]);

  async function loadAll(apiKey: string) {
    setError(null);
    setLoading(true);
    try {
      const [lmData, wfData, rawMapping] = await Promise.all([
        fetchAllAccounts(apiKey),
        ctx.api.accounts.getAll(),
        ctx.api.secrets.get(MAPPING_SECRET_KEY),
      ]);

      const parsed = deserializeMapping(rawMapping);
      const wfIdSet = new Set(wfData.map((a) => String(a.id)));

      // Reset stale 'existing' references
      const cleaned: AccountMapping = {};
      for (const [key, entry] of Object.entries(parsed)) {
        if (entry.type === 'existing' && !wfIdSet.has(entry.wfAccountId)) {
          cleaned[Number(key)] = { type: 'ignore' };
        } else {
          cleaned[Number(key)] = entry;
        }
      }

      setLmAccounts(lmData);
      setWfAccounts(wfData);
      setSavedMapping(cleaned);
      setDraft(cleaned);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    const apiKey = await ctx.api.secrets.get('lunchmoney-api-key');
    if (apiKey) loadAll(apiKey);
  }

  function handleDraftChange(lmId: number, entry: MappingEntry) {
    setDraft((prev) => ({ ...prev, [lmId]: entry }));
  }

  async function handleConfirm() {
    setIsSaving(true);
    setShowConfirm(false);
    try {
      const finalDraft: AccountMapping = { ...draft };

      for (const [idStr, entry] of Object.entries(draft)) {
        if (entry.type !== 'create') continue;
        const lmId = Number(idStr);
        const lm = lmAccounts?.find((a) => a.id === lmId);
        if (!lm) continue;

        const created = await ctx.api.accounts.create({
          name: lm.display_name || lm.name,
          accountType: 'CASH',
          currency: lm.currency.toUpperCase(),
          balance: parseFloat(lm.balance),
          isDefault: false,
          isActive: true,
          group: lm.institution_name || undefined,
        });

        finalDraft[lmId] = { type: 'existing', wfAccountId: String(created.id) };
      }

      await ctx.api.secrets.set(MAPPING_SECRET_KEY, serializeMapping(finalDraft));

      const wfData = await ctx.api.accounts.getAll();
      setWfAccounts(wfData);
      setSavedMapping(finalDraft);
      setDraft(finalDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }

  const isDirty = !mappingsEqual(draft, savedMapping);

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
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSettings(true)}
          >
            <Icons.Settings className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <Button onClick={handleRefresh} disabled={loading || !hasApiKey}>
            {loading ? (
              <>
                <Icons.Loader className="h-4 w-4 mr-2 animate-spin" />
                Fetching…
              </>
            ) : (
              'Refresh Lunch Money accounts'
            )}
          </Button>

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

          {!hasApiKey && (
            <p className="mt-6 text-sm text-muted-foreground text-center">
              Add your Lunch Money access token to get started
            </p>
          )}

          {hasApiKey && lmAccounts !== null && lmAccounts.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              No accounts found.
            </p>
          )}

          {hasApiKey && lmAccounts !== null && lmAccounts.length > 0 && wfAccounts !== null && (
            <>
              <AccountLinkTable
                lmAccounts={lmAccounts}
                wfAccounts={wfAccounts}
                savedMapping={savedMapping}
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
                    onClick={() => setDraft(savedMapping)}
                    disabled={isSaving}
                  >
                    Undo
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {lmAccounts && wfAccounts && (
        <ConfirmSaveDialog
          open={showConfirm}
          draft={draft}
          savedMapping={savedMapping}
          lmAccounts={lmAccounts}
          wfAccounts={wfAccounts}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
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
