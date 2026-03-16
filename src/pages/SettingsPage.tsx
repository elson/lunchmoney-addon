import React, { useState, useEffect } from "react";
import type { AddonContext } from "@wealthfolio/addon-sdk";
import { Button, Input, Label, Page, PageHeader, PageContent, Separator } from "@wealthfolio/ui";
import { API_KEY_SECRET } from "../lib/secrets";

export default function SettingsPage({ ctx }: { ctx: AddonContext }) {
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<"idle" | "saved" | "cleared">("idle");

  useEffect(() => {
    ctx.api.secrets.get(API_KEY_SECRET).then((val) => {
      if (val) setApiKey(val);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    await ctx.api.secrets.set(API_KEY_SECRET, apiKey);
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  }

  async function handleClear() {
    await ctx.api.secrets.delete(API_KEY_SECRET);
    setApiKey("");
    setStatus("cleared");
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <Page>
      <PageHeader
        heading="Lunch Money Add-on"
        text="Synchronise your Lunch Money cash balances to Wealthfolio"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => ctx.api.navigation.navigate("/addon/lunch-money")}
          >
            Close
          </Button>
        }
      />
      <Separator />
      <PageContent withPadding>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">Lunch Money API Key</Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Lunch Money API key"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={!apiKey}>
              Save
            </Button>
            <Button variant="outline" onClick={handleClear}>
              Clear
            </Button>
            {status === "saved" && <span className="text-sm text-green-600">Saved!</span>}
            {status === "cleared" && (
              <span className="text-muted-foreground text-sm">Cleared.</span>
            )}
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
