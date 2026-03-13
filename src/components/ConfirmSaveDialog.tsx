import React from 'react';
import type { Account } from '@wealthfolio/addon-sdk';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@wealthfolio/ui';
import type { LunchmoneyAccount } from '../lib/lunchmoney';
import type { AccountMapping } from '../types';

interface ConfirmSaveDialogProps {
  open: boolean;
  draft: AccountMapping;
  savedMapping: AccountMapping;
  lmAccounts: LunchmoneyAccount[];
  wfAccounts: Account[];
  onConfirm: () => void;
  onCancel: () => void;
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

  const toCreate: LunchmoneyAccount[] = [];
  const toLink: { lm: LunchmoneyAccount; wf: Account }[] = [];
  const unchanged: { lm: LunchmoneyAccount; wf: Account }[] = [];

  for (const [idStr, entry] of Object.entries(draft)) {
    const lm = lmById[Number(idStr)];
    if (!lm) continue;
    if (entry.type === 'create') {
      toCreate.push(lm);
    } else if (entry.type === 'existing') {
      const wf = wfById[entry.wfAccountId];
      if (!wf) continue;
      const saved = savedMapping[Number(idStr)];
      const isUnchanged =
        saved?.type === 'existing' && saved.wfAccountId === entry.wfAccountId;
      if (isUnchanged) {
        unchanged.push({ lm, wf });
      } else {
        toLink.push({ lm, wf });
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm changes</DialogTitle>
        </DialogHeader>

        {toCreate.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Accounts to create:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              {toCreate.map((a) => (
                <li key={a.id}>
                  {a.display_name || a.name}{' '}
                  {a.institution_name && (
                    <span className="text-xs">(group: {a.institution_name})</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {toLink.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Accounts to link:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              {toLink.map(({ lm, wf }) => (
                <li key={lm.id}>
                  {lm.display_name || lm.name} → {wf.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {unchanged.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Unchanged:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              {unchanged.map(({ lm, wf }) => (
                <li key={lm.id}>
                  {lm.display_name || lm.name} → {wf.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {toCreate.length === 0 && toLink.length === 0 && unchanged.length === 0 && (
          <p className="text-sm text-muted-foreground">No changes to apply.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={toCreate.length === 0 && toLink.length === 0}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
