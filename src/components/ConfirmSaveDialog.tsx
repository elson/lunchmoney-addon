import React from "react";
import type { Account } from "@wealthfolio/addon-sdk";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wealthfolio/ui";
import type { LunchmoneyAccount } from "../lib/lunchmoney";
import type { AccountMapping } from "../types";

interface ConfirmSaveDialogProps {
  open: boolean;
  draft: AccountMapping;
  savedMapping: AccountMapping;
  lmAccounts: LunchmoneyAccount[];
  wfAccounts: Account[];
  onConfirm: () => void;
  onCancel: () => void;
}

function lmName(lm: LunchmoneyAccount) {
  return lm.display_name || lm.name;
}

export function ConfirmSaveDialog({
  open,
  draft,
  savedMapping,
  lmAccounts,
  wfAccounts,
  onConfirm,
  onCancel,
}: ConfirmSaveDialogProps) {
  const lmById = Object.fromEntries(lmAccounts.map((a) => [a.id, a]));
  const wfById = Object.fromEntries(wfAccounts.map((a) => [String(a.id), a]));

  const toCreate: { lm: LunchmoneyAccount; wasLinkedTo?: Account }[] = [];
  const toLink: { lm: LunchmoneyAccount; wf: Account }[] = [];
  const toRelink: { lm: LunchmoneyAccount; from: Account; to: Account }[] = [];
  const toUnlink: { lm: LunchmoneyAccount; wf: Account }[] = [];
  const unchanged: { lm: LunchmoneyAccount; wf: Account }[] = [];

  // Classify every draft entry
  for (const [idStr, entry] of Object.entries(draft)) {
    const lmId = Number(idStr);
    const lm = lmById[lmId];
    if (!lm) continue;
    const saved = savedMapping[lmId];

    if (entry.type === "create") {
      const wasLinkedTo = saved?.type === "existing" ? wfById[saved.wfAccountId] : undefined;
      toCreate.push({ lm, wasLinkedTo });
    } else if (entry.type === "existing") {
      const wf = wfById[entry.wfAccountId];
      if (!wf) continue;
      if (!saved || saved.type === "ignore") {
        toLink.push({ lm, wf });
      } else if (saved.type === "existing") {
        if (saved.wfAccountId === entry.wfAccountId) {
          unchanged.push({ lm, wf });
        } else {
          const from = wfById[saved.wfAccountId];
          if (from) {
            toRelink.push({ lm, from, to: wf });
          } else {
            toLink.push({ lm, wf });
          }
        }
      }
    }
    // entry.type === 'ignore' handled in the unlink pass below
  }

  // Find existing links that are being removed (saved=existing, draft=ignore or absent)
  for (const [idStr, saved] of Object.entries(savedMapping)) {
    if (saved.type !== "existing") continue;
    const lmId = Number(idStr);
    const draftEntry = draft[lmId];
    // 'create' transitions are already captured above with wasLinkedTo
    if (!draftEntry || draftEntry.type === "ignore") {
      const lm = lmById[lmId];
      const wf = wfById[saved.wfAccountId];
      if (lm && wf) toUnlink.push({ lm, wf });
    }
  }

  const hasChanges =
    toCreate.length > 0 || toLink.length > 0 || toRelink.length > 0 || toUnlink.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm changes</DialogTitle>
        </DialogHeader>

        {toCreate.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Accounts to create:</p>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
              {toCreate.map(({ lm, wasLinkedTo }) => (
                <li key={lm.id}>
                  {lmName(lm)}
                  {lm.institution_name && (
                    <span className="text-xs"> (group: {lm.institution_name})</span>
                  )}
                  {wasLinkedTo && (
                    <span className="text-xs"> — unlinks from {wasLinkedTo.name}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {toLink.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Accounts to link:</p>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
              {toLink.map(({ lm, wf }) => (
                <li key={lm.id}>
                  {lmName(lm)} → {wf.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {toRelink.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Accounts to relink:</p>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
              {toRelink.map(({ lm, from, to }) => (
                <li key={lm.id}>
                  {lmName(lm)}: {from.name} → {to.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {toUnlink.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Accounts to unlink:</p>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
              {toUnlink.map(({ lm, wf }) => (
                <li key={lm.id}>
                  {lmName(lm)} — removes link to {wf.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {unchanged.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Unchanged:</p>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
              {unchanged.map(({ lm, wf }) => (
                <li key={lm.id}>
                  {lmName(lm)} → {wf.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!hasChanges && unchanged.length === 0 && (
          <p className="text-muted-foreground text-sm">No changes to apply.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!hasChanges}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
