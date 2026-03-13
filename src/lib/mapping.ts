import type { MappingEntry, AccountMapping } from '../types';

export const MAPPING_SECRET_KEY = 'account-mapping';

export function serializeMapping(mapping: AccountMapping): string {
  return JSON.stringify(mapping);
}

export function deserializeMapping(raw: string | null): AccountMapping {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as AccountMapping;
  } catch {
    return {};
  }
}

export function entryToSelectValue(entry: MappingEntry): string {
  if (entry.type === 'ignore') return 'ignore';
  if (entry.type === 'create') return 'create';
  return `existing:${entry.wfAccountId}`;
}

export function selectValueToEntry(val: string): MappingEntry {
  if (val === 'ignore') return { type: 'ignore' };
  if (val === 'create') return { type: 'create' };
  if (val.startsWith('existing:')) {
    return { type: 'existing', wfAccountId: val.slice('existing:'.length) };
  }
  return { type: 'ignore' };
}

export function mappingsEqual(a: AccountMapping, b: AccountMapping): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    const ae = a[Number(key)];
    const be = b[Number(key)];
    if (!be) return false;
    if (ae.type !== be.type) return false;
    if (ae.type === 'existing' && be.type === 'existing') {
      if (ae.wfAccountId !== be.wfAccountId) return false;
    }
  }
  return true;
}

export function claimedWfIds(draft: AccountMapping): Set<string> {
  const ids = new Set<string>();
  for (const entry of Object.values(draft)) {
    if (entry.type === 'existing') ids.add(entry.wfAccountId);
  }
  return ids;
}
