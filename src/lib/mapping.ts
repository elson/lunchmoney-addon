import type { AccountMapping } from '../types';

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

export function cleanMapping(
  mapping: AccountMapping,
  validWfIds: Set<string>,
): AccountMapping {
  const cleaned: AccountMapping = {};
  for (const [key, entry] of Object.entries(mapping)) {
    cleaned[Number(key)] =
      entry.type === 'existing' && !validWfIds.has(entry.wfAccountId)
        ? { type: 'ignore' }
        : entry;
  }
  return cleaned;
}

export function claimedWfIds(draft: AccountMapping): Set<string> {
  const ids = new Set<string>();
  for (const entry of Object.values(draft)) {
    if (entry.type === 'existing') ids.add(entry.wfAccountId);
  }
  return ids;
}
