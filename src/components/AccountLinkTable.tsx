import React from 'react';
import type { Account } from '@wealthfolio/addon-sdk';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@wealthfolio/ui';
function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  );
}

function LinkOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      <line x1="2" y1="2" x2="22" y2="22"/>
    </svg>
  );
}
import type { LunchmoneyAccount } from '../lib/lunchmoney';
import type { AccountMapping, MappingEntry } from '../types';
import { claimedWfIds } from '../lib/mapping';

function entryToSelectValue(entry: MappingEntry): string {
  if (entry.type === 'ignore') return 'ignore';
  if (entry.type === 'create') return 'create';
  return `existing:${entry.wfAccountId}`;
}

function selectValueToEntry(val: string): MappingEntry {
  if (val === 'ignore') return { type: 'ignore' };
  if (val === 'create') return { type: 'create' };
  if (val.startsWith('existing:')) {
    return { type: 'existing', wfAccountId: val.slice('existing:'.length) };
  }
  return { type: 'ignore' };
}

interface AccountLinkTableProps {
  lmAccounts: LunchmoneyAccount[];
  wfAccounts: Account[];
  draft: AccountMapping;
  onDraftChange: (lmId: number, entry: MappingEntry) => void;
}

interface WfAccountSelectProps {
  lmId: number;
  wfAccounts: Account[];
  draft: AccountMapping;
  onDraftChange: (lmId: number, entry: MappingEntry) => void;
}

function WfAccountSelect({
  lmId,
  wfAccounts,
  draft,
  onDraftChange,
}: WfAccountSelectProps) {
  const claimed = claimedWfIds(draft);
  const currentEntry: MappingEntry = draft[lmId] ?? { type: 'ignore' };
  const currentValue = entryToSelectValue(currentEntry);

  const currentWfId =
    currentEntry.type === 'existing' ? currentEntry.wfAccountId : null;

  const available = wfAccounts.filter(
    (a) => !claimed.has(String(a.id)) || String(a.id) === currentWfId,
  );

  return (
    <Select
      value={currentValue}
      onValueChange={(val) => onDraftChange(lmId, selectValueToEntry(val))}
    >
      <SelectTrigger className="w-[200px] h-8 text-sm">
        <SelectValue placeholder="Ignore" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ignore">Ignore</SelectItem>
        <SelectItem value="create">Create new…</SelectItem>
        {available.map((a) => (
          <SelectItem key={a.id} value={`existing:${a.id}`}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AccountLinkTable({
  lmAccounts,
  wfAccounts,
  draft,
  onDraftChange,
}: AccountLinkTableProps) {
  const grouped = lmAccounts.reduce<Record<string, LunchmoneyAccount[]>>(
    (acc, a) => {
      const key = a.institution_name || 'Other';
      (acc[key] ??= []).push(a);
      return acc;
    },
    {},
  );

  return (
    <div className="mt-4 space-y-6">
      {Object.entries(grouped).map(([institution, rows]) => (
        <div key={institution}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {institution}
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-left">
                <th className="pb-2 font-medium">Lunch Money Account</th>
                <th className="pb-2 w-6"></th>
                <th className="pb-2 font-medium pl-2">Wealthfolio Account</th>
                <th className="pb-2 font-medium pl-4">Type</th>
                <th className="pb-2 font-medium pl-4">Subtype</th>
                <th className="pb-2 font-medium pl-4">Currency</th>
                <th className="pb-2 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((acc) => (
                <tr key={acc.id} className="border-b last:border-0">
                  <td className="py-2 pr-4">{acc.display_name || acc.name}</td>
                  <td className="py-2 w-6">
                    {acc.type === 'cash' ? (
                      (() => {
                        const entry = draft[acc.id];
                        const isLinked = entry?.type === 'existing' || entry?.type === 'create';
                        return isLinked ? (
                          <LinkIcon className="w-4 h-4 text-green-500" />
                        ) : (
                          <LinkOffIcon className="w-4 h-4 text-amber-500" />
                        );
                      })()
                    ) : null}
                  </td>
                  <td className="py-2 pl-2">
                    {acc.type === 'cash' ? (
                      <WfAccountSelect
                        lmId={acc.id}
                        wfAccounts={wfAccounts}
                        draft={draft}
                        onDraftChange={onDraftChange}
                      />
                    ) : null}
                  </td>
                  <td className="py-2 pl-4 pr-4 text-muted-foreground capitalize">
                    {acc.type}
                  </td>
                  <td className="py-2 pl-4 pr-4 text-muted-foreground capitalize">
                    {acc.subtype ?? '—'}
                  </td>
                  <td className="py-2 pl-4 pr-4 uppercase text-muted-foreground">
                    {acc.currency}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {parseFloat(acc.balance).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
