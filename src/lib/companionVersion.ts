import type { AddonContext } from "@wealthfolio/addon-sdk";
import {
  ADDON_VERSION_STORAGE_KEY,
  COMPANION_STORAGE_KEY,
  VERSION,
  parseCompanionInfo,
  versionMismatch,
  type VersionMismatch,
} from "./version";

/** Records this add-on's version for the sync companion to compare. Never throws. */
export async function recordAddonVersion(ctx: AddonContext): Promise<void> {
  try {
    if ((await ctx.api.storage.get(ADDON_VERSION_STORAGE_KEY)) === VERSION) return;
    await ctx.api.storage.set(ADDON_VERSION_STORAGE_KEY, VERSION);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.api.logger.warn(`Couldn't record the add-on version for the sync companion: ${message}`);
  }
}

/** How the add-on and the companion's last recorded version differ; null when they match or there's no companion. */
export async function loadCompanionMismatch(ctx: AddonContext): Promise<VersionMismatch | null> {
  try {
    const companion = parseCompanionInfo(await ctx.api.storage.get(COMPANION_STORAGE_KEY));
    return companion && versionMismatch({ addon: VERSION, companion: companion.version });
  } catch {
    return null;
  }
}
