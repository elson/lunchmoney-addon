import type { Account } from "@wealthfolio/addon-sdk";
import type { LunchmoneyAccount } from "./lunchmoney";
import type { AccountMapping } from "../types";

export interface ChangeClassification {
  toCreate: { lm: LunchmoneyAccount; wasLinkedTo?: Account }[];
  toLink: { lm: LunchmoneyAccount; wf: Account }[];
  toRelink: { lm: LunchmoneyAccount; from: Account; to: Account }[];
  toUnlink: { lm: LunchmoneyAccount; wf: Account }[];
  unchanged: { lm: LunchmoneyAccount; wf: Account }[];
  hasChanges: boolean;
}

export function classifyChanges(
  draft: AccountMapping,
  savedMapping: AccountMapping,
  lmAccounts: LunchmoneyAccount[],
  wfAccounts: Account[],
): ChangeClassification {
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

  return { toCreate, toLink, toRelink, toUnlink, unchanged, hasChanges };
}
