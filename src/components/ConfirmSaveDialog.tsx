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
import { ChangeSummary } from "./ChangeSummary";

interface ConfirmSaveDialogProps {
  open: boolean;
  vm: AccountViewModel;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmSaveDialog({ open, vm, onConfirm, onCancel }: ConfirmSaveDialogProps) {
  const { hasChanges } = vm.changes;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm changes</DialogTitle>
        </DialogHeader>

        <ChangeSummary changes={vm.changes} />

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
