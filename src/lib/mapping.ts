import type { AddonContext } from "@wealthfolio/addon-sdk";
import type { AccountMapping } from "../types";

const MAPPING_STORAGE_KEY = "lunchmoney-addon:account-mapping";
const LAST_SYNCED_STORAGE_KEY = "lunchmoney-addon:last-synced";

// Legacy key — used only for one-time migration from secrets to localStorage
const MAPPING_SECRET_KEY_LEGACY = "account-mapping";

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

/**
 * Load mapping from localStorage, migrating from secrets on first run if needed.
 */
export async function loadMapping(ctx: AddonContext): Promise<AccountMapping> {
  const stored = localStorage.getItem(MAPPING_STORAGE_KEY);
  if (stored !== null) {
    return deserializeMapping(stored);
  }

  // One-time migration: pull from secrets, write to localStorage, delete from secrets
  const fromSecrets = await ctx.api.secrets.get(MAPPING_SECRET_KEY_LEGACY);
  if (fromSecrets) {
    localStorage.setItem(MAPPING_STORAGE_KEY, fromSecrets);
    await ctx.api.secrets.delete(MAPPING_SECRET_KEY_LEGACY);
    return deserializeMapping(fromSecrets);
  }

  return {};
}

export function saveMapping(mapping: AccountMapping): void {
  localStorage.setItem(MAPPING_STORAGE_KEY, serializeMapping(mapping));
}

export function loadLastSynced(): Date | null {
  const raw = localStorage.getItem(LAST_SYNCED_STORAGE_KEY);
  if (!raw) return null;
  const ts = Number(raw);
  return isNaN(ts) ? null : new Date(ts);
}

export function saveLastSynced(): void {
  localStorage.setItem(LAST_SYNCED_STORAGE_KEY, String(Date.now()));
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
    if (ae.type === "existing" && be.type === "existing") {
      if (ae.wfAccountId !== be.wfAccountId) return false;
    }
  }
  return true;
}

export function cleanMapping(
  mapping: AccountMapping,
  validWfIds: Set<string>,
  validLmIds: Set<number>,
): AccountMapping {
  const cleaned: AccountMapping = {};
  for (const [key, entry] of Object.entries(mapping)) {
    const lmId = Number(key);
    if (!validLmIds.has(lmId)) continue; // LM account deleted — drop entry entirely
    cleaned[lmId] =
      entry.type === "existing" && !validWfIds.has(entry.wfAccountId) ? { type: "ignore" } : entry;
  }
  return cleaned;
}

export function claimedWfIds(draft: AccountMapping): Set<string> {
  const ids = new Set<string>();
  for (const entry of Object.values(draft)) {
    if (entry.type === "existing") ids.add(entry.wfAccountId);
  }
  return ids;
}
