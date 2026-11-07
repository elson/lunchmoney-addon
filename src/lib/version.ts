import manifest from "../../manifest.json";

/** This build's version, shared by the add-on and the companion (one release, one version). */
export const VERSION: string = manifest.version;

/** Where the add-on records its version for the companion to read. */
export const ADDON_VERSION_STORAGE_KEY = "lunchmoney-addon:addon-version";
/** Where the companion records its version (and last run) for the add-on to read. */
export const COMPANION_STORAGE_KEY = "lunchmoney-addon:companion";

export interface CompanionInfo {
  version: string;
  lastRunAt: string;
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export interface VersionMismatch {
  outdated: "addon" | "companion";
  message: string;
}

/** Null when both sides run the same release; otherwise which one to update, and how. */
export function versionMismatch(v: { addon: string; companion: string }): VersionMismatch | null {
  const order = compareVersions(v.addon, v.companion);
  if (order === 0) return null;
  return order > 0
    ? {
        outdated: "companion",
        message: `The sync companion is on v${v.companion} but the add-on is on v${v.addon}. Pull the latest companion image.`,
      }
    : {
        outdated: "addon",
        message: `The add-on is on v${v.addon} but the sync companion is on v${v.companion}. Install the latest add-on release.`,
      };
}

export function parseCompanionInfo(raw: string | null): CompanionInfo | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CompanionInfo> | null;
    if (!parsed || typeof parsed !== "object" || typeof parsed.version !== "string") return null;
    return { version: parsed.version, lastRunAt: String(parsed.lastRunAt ?? "") };
  } catch {
    return null;
  }
}
