import React, { useState } from 'react';
import type { AddonContext } from '@wealthfolio/addon-sdk';
import { Card, CardContent, CardHeader, CardTitle, Icons, Button } from '@wealthfolio/ui';
import { SettingsPage } from './pages';
import { fetchAllAccounts, type LunchmoneyAccount } from './lib/lunchmoney';

function AccountTable({ accounts }: { accounts: LunchmoneyAccount[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground text-left">
            <th className="pb-2 font-medium">Name</th>
            <th className="pb-2 font-medium">Currency</th>
            <th className="pb-2 font-medium text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((acc) => (
            <tr key={acc.id} className="border-b last:border-0">
              <td className="py-2 pr-4">{acc.display_name || acc.name}</td>
              <td className="py-2 pr-4 uppercase text-muted-foreground">{acc.currency}</td>
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
  );
}

function AddonMain({ ctx }: { ctx: AddonContext }) {
  const [showSettings, setShowSettings] = useState(false);
  const [accounts, setAccounts] = useState<LunchmoneyAccount[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (showSettings) {
    return (
      <div>
        <div className="px-6 pt-6">
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
            <Icons.ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>
        <SettingsPage ctx={ctx} />
      </div>
    );
  }

  async function handleFetch() {
    setError(null);
    setLoading(true);
    try {
      const apiKey = await ctx.api.secrets.get('lunchmoney-api-key');
      if (!apiKey) {
        setError('No API key found. Please set your Lunchmoney API key in Settings.');
        return;
      }
      const data = await fetchAllAccounts(apiKey);
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Lunchmoney Accounts</CardTitle>
          <Button variant="outline" size="icon" onClick={() => setShowSettings(true)}>
            <Icons.Settings className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <Button onClick={handleFetch} disabled={loading}>
            {loading ? (
              <>
                <Icons.Loader className="h-4 w-4 mr-2 animate-spin" />
                Fetching…
              </>
            ) : (
              'Fetch Lunchmoney account details'
            )}
          </Button>

          {error && (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          )}

          {accounts !== null && accounts.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">No accounts found.</p>
          )}

          {accounts !== null && accounts.length > 0 && (
            <AccountTable accounts={accounts} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function enable(ctx: AddonContext) {
  const sidebarItem = ctx.sidebar.addItem({
    id: 'lunchmoney-addon',
    label: 'lunchmoney-addon',
    icon: <Icons.Blocks className="h-5 w-5" />,
    route: '/addon/lunchmoney-addon',
    order: 100,
  });

  const Wrapper = () => <AddonMain ctx={ctx} />;
  ctx.router.add({
    path: '/addon/lunchmoney-addon',
    component: React.lazy(() => Promise.resolve({ default: Wrapper })),
  });

  ctx.onDisable(() => {
    try {
      sidebarItem.remove();
    } catch (err) {
      ctx.api.logger.error('Failed to remove sidebar item:', err);
    }
  });
}
