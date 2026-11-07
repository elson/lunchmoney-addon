import React, { useCallback, useEffect, useState } from "react";
import type { AddonContext } from "@wealthfolio/addon-sdk";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Icons,
  Input,
  Label,
  Page,
  PageContent,
  PageHeader,
  Separator,
  cn,
} from "@wealthfolio/ui";
import {
  checkConnection,
  clearApiKey,
  getApiKey,
  setApiKey,
  type ConnectionStatus,
} from "../lib/lunchmoney";
import { MAIN_ROUTE } from "../lib/routes";

type Connection =
  | { state: "checking" }
  | { state: "none" }
  | ({ state: "checked" } & ConnectionStatus);

export default function SettingsPage({ ctx }: { ctx: AddonContext }) {
  const [connection, setConnection] = useState<Connection>({ state: "checking" });
  const [tokenInput, setTokenInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const refreshConnection = useCallback(async () => {
    setConnection({ state: "checking" });
    // The token itself is never read back into the UI — only whether one exists.
    if (!(await getApiKey(ctx))) {
      setConnection({ state: "none" });
      return;
    }
    setConnection({ state: "checked", ...(await checkConnection(ctx)) });
  }, [ctx]);

  useEffect(() => {
    refreshConnection();
  }, [refreshConnection]);

  async function handleSave() {
    setSaving(true);
    try {
      await setApiKey(ctx, tokenInput.trim());
      setTokenInput("");
      setShowToken(false);
      await refreshConnection();
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setConfirmRemove(false);
    await clearApiKey(ctx);
    await refreshConnection();
  }

  const hasToken = connection.state === "checked";

  return (
    <Page>
      <PageHeader
        heading="Lunch Money Settings"
        text="Connect Wealthfolio to your Lunch Money budget"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => ctx.api.navigation.navigate(MAIN_ROUTE.path)}
          >
            <Icons.ArrowLeft className="h-4 w-4" />
            Back to accounts
          </Button>
        }
      />
      <Separator />
      <PageContent withPadding>
        <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Connection</CardTitle>
              <CardDescription>
                The add-on reads your account balances from Lunch Money. It never changes anything
                in Lunch Money.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ConnectionLine connection={connection} />

              <div className="space-y-2">
                <Label htmlFor="api-key">Access token</Label>
                <div className="relative">
                  <Input
                    id="api-key"
                    type={showToken ? "text" : "password"}
                    autoComplete="off"
                    spellCheck={false}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder={
                      hasToken
                        ? "Paste a new token to replace the saved one"
                        : "Paste your Lunch Money access token"
                    }
                    className="pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((s) => !s)}
                    aria-label={showToken ? "Hide token" : "Show token"}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                  >
                    {showToken ? (
                      <Icons.EyeOff className="h-4 w-4" />
                    ) : (
                      <Icons.Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-muted-foreground text-sm">
                  Create one in Lunch Money under <strong>Settings → Developers</strong>. It’s
                  stored encrypted in Wealthfolio and only ever sent to api.lunchmoney.dev.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between gap-2">
              <Button onClick={handleSave} disabled={!tokenInput.trim() || saving}>
                {saving ? (
                  <>
                    <Icons.Spinner className="h-4 w-4 animate-spin" />
                    Connecting…
                  </>
                ) : (
                  "Save and connect"
                )}
              </Button>
              {hasToken && (
                <Button
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setConfirmRemove(true)}
                >
                  Remove token
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>

        <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove your Lunch Money token?</AlertDialogTitle>
              <AlertDialogDescription>
                Linked accounts stay linked, but balances can’t sync until you add a token again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleRemove}>
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContent>
    </Page>
  );
}

function ConnectionLine({ connection }: { connection: Connection }) {
  let tone: "muted" | "success" | "destructive" = "muted";
  let text: string;
  if (connection.state === "checking") {
    text = "Checking connection…";
  } else if (connection.state === "none") {
    text = "Not connected";
  } else if (connection.ok) {
    tone = "success";
    text = `Connected to ${connection.budgetName} as ${connection.userName}`;
  } else if (connection.reason === "unauthorized") {
    tone = "destructive";
    text = "Lunch Money rejected this token. Check it and try again.";
  } else {
    tone = "destructive";
    text = `Couldn't reach Lunch Money: ${connection.message}`;
  }

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2 text-sm",
        tone === "success" && "text-success",
        tone === "destructive" && "text-destructive",
        tone === "muted" && "text-muted-foreground",
      )}
    >
      {connection.state === "checking" ? (
        <Icons.Spinner className="h-4 w-4 animate-spin" />
      ) : tone === "success" ? (
        <Icons.CheckCircle className="h-4 w-4" />
      ) : tone === "destructive" ? (
        <Icons.AlertCircle className="h-4 w-4" />
      ) : (
        <Icons.Circle className="h-4 w-4" />
      )}
      {text}
    </div>
  );
}
