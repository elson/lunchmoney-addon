import React, { useEffect, useState } from "react";
import type { AddonContext } from "@wealthfolio/addon-sdk";
import { Alert, AlertDescription, AlertTitle, Icons } from "@wealthfolio/ui";
import { loadCompanionMismatch } from "../lib/companionVersion";
import type { VersionMismatch } from "../lib/version";

/** Warns when the Docker sync companion runs a different release than this add-on. */
export function CompanionVersionAlert({ ctx }: { ctx: AddonContext }) {
  const [mismatch, setMismatch] = useState<VersionMismatch | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadCompanionMismatch(ctx).then((m) => {
      if (!cancelled) setMismatch(m);
    });
    return () => {
      cancelled = true;
    };
  }, [ctx]);

  if (!mismatch) return null;
  return (
    <Alert variant="warning" className="mb-4">
      <Icons.AlertTriangle className="h-4 w-4" />
      <AlertTitle>Add-on and sync companion versions differ</AlertTitle>
      <AlertDescription>{mismatch.message}</AlertDescription>
    </Alert>
  );
}
