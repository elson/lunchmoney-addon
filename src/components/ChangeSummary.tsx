import React from "react";
import type { ChangeClassification } from "../lib/accountViewModel";
import type { LunchmoneyAccount } from "../lib/lunchmoney";

function lmName(lm: LunchmoneyAccount) {
  return lm.display_name || lm.name;
}

/** Lists what saving the draft will do: create, link, relink, unlink, unchanged. */
export function ChangeSummary({ changes }: { changes: ChangeClassification }) {
  const { toCreate, toLink, toRelink, toUnlink, unchanged, hasChanges } = changes;
  return (
    <div className="space-y-4">
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
                {wasLinkedTo && <span className="text-xs"> — unlinks from {wasLinkedTo.name}</span>}
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
    </div>
  );
}
