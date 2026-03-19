import React from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wealthfolio/ui";
import type { AccountViewModel } from "../lib/accountViewModel";
import type { LunchmoneyAccount } from "../lib/lunchmoney";

interface ConfirmSaveDialogProps {
  open: boolean;
  vm: AccountViewModel;
  onConfirm: () => void;
  onCancel: () => void;
}

function lmName(lm: LunchmoneyAccount) {
  return lm.display_name || lm.name;
}

export function ConfirmSaveDialog({ open, vm, onConfirm, onCancel }: ConfirmSaveDialogProps) {
  const { toCreate, toLink, toRelink, toUnlink, unchanged, hasChanges } = vm.changes;

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
