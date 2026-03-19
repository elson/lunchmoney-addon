import React, { useState, useEffect } from "react";
import type { AddonContext } from "@wealthfolio/addon-sdk";
import { Button, Input, Label, Page, PageHeader, PageContent, Separator } from "@wealthfolio/ui";
import { getApiKey, setApiKey, clearApiKey } from "../lib/lunchmoney";

export default function SettingsPage({ ctx }: { ctx: AddonContext }) {
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [status, setStatus] = useState<"idle" | "saved" | "cleared">("idle");

  useEffect(() => {
    getApiKey(ctx).then((val) => {
      if (val) setApiKeyInput(val);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    await setApiKey(ctx, apiKeyInput);
    setStatus("saved");
    // c8 ignore next
    setTimeout(() => setStatus("idle"), 2000);
  }

  async function handleClear() {
    await clearApiKey(ctx);
    setApiKeyInput("");
    setStatus("cleared");
    // c8 ignore next
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <Page>
      <PageHeader
        heading="Lunch Money Settings"
        text="Add your Lunch Money access token"
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
            <Label htmlFor="api-key">Lunch Money access token</Label>
            <Input
              id="api-key"
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Enter your Lunch Money API key"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={!apiKeyInput}>
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
