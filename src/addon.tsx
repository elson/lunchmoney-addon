import React, { useState, useEffect } from 'react';
import type { AddonContext } from '@wealthfolio/addon-sdk';
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

function AccountTable({ accounts }: { accounts: LunchmoneyAccount[] }) {
  const grouped = accounts.reduce<Record<string, LunchmoneyAccount[]>>(
    (acc, a) => {
      const key = a.institution_name || 'Other';
      (acc[key] ??= []).push(a);
      return acc;
    },
    {},
  );

  return (
    <div className="mt-4 space-y-6">
      {Object.entries(grouped).map(([institution, rows]) => (
        <div key={institution}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {institution}
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-left">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Subtype</th>
                <th className="pb-2 font-medium">Currency</th>
                <th className="pb-2 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((acc) => (
                <tr key={acc.id} className="border-b last:border-0">
                  <td className="py-2 pr-4">{acc.display_name || acc.name}</td>
                  <td className="py-2 pr-4 text-muted-foreground capitalize">
                    {acc.type}
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground capitalize">
                    {acc.subtype ?? '—'}
                  </td>
                  <td className="py-2 pr-4 uppercase text-muted-foreground">
                    {acc.currency}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {parseFloat(acc.balance).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function AddonMain({ ctx }: { ctx: AddonContext }) {
  const [showSettings, setShowSettings] = useState(false);
  const [accounts, setAccounts] = useState<LunchmoneyAccount[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  useEffect(() => {
    if (showSettings) return;
    ctx.api.secrets.get('lunchmoney-api-key').then((key) => {
      setHasApiKey(!!key);
      if (key) {
        fetchAccounts(key);
      } else {
        setAccounts(null);
      }
    });
  }, [showSettings]);

  async function fetchAccounts(apiKey: string) {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchAllAccounts(apiKey);
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    const apiKey = await ctx.api.secrets.get('lunchmoney-api-key');
    if (apiKey) fetchAccounts(apiKey);
  }

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

          {hasApiKey && accounts !== null && accounts.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              No accounts found.
            </p>
          )}

          {hasApiKey && accounts !== null && accounts.length > 0 && (
            <AccountTable accounts={accounts} />
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
