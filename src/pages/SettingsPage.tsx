import React, { useState, useEffect } from 'react';
import type { AddonContext } from '@wealthfolio/addon-sdk';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
} from '@wealthfolio/ui';

const API_KEY_SECRET = 'lunchmoney-api-key';

export default function SettingsPage({ ctx }: { ctx: AddonContext }) {
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'saved' | 'cleared'>('idle');

  useEffect(() => {
    ctx.api.secrets.get(API_KEY_SECRET).then((val) => {
      if (val) setApiKey(val);
    });
  }, []);

  async function handleSave() {
    await ctx.api.secrets.set(API_KEY_SECRET, apiKey);
    setStatus('saved');
    setTimeout(() => setStatus('idle'), 2000);
  }

  async function handleClear() {
    await ctx.api.secrets.delete(API_KEY_SECRET);
    setApiKey('');
    setStatus('cleared');
    setTimeout(() => setStatus('idle'), 2000);
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Lunchmoney Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">Lunchmoney API Key</Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Lunchmoney API key"
            />
          </div>
          <div className="flex gap-2 items-center">
            <Button onClick={handleSave} disabled={!apiKey}>
              Save
            </Button>
            <Button variant="outline" onClick={handleClear}>
              Clear
            </Button>
            {status === 'saved' && (
              <span className="text-sm text-green-600">Saved!</span>
            )}
            {status === 'cleared' && (
              <span className="text-sm text-muted-foreground">Cleared.</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
