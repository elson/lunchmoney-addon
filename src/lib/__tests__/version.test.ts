import { describe, expect, it } from "vitest";
import manifest from "../../../manifest.json";
import pkg from "../../../package.json";
import {
  ADDON_VERSION_STORAGE_KEY,
  COMPANION_STORAGE_KEY,
  VERSION,
  compareVersions,
  parseCompanionInfo,
  versionMismatch,
} from "../version";

describe("VERSION", () => {
  it("is the release version, the same in the manifest and package.json", () => {
    expect(VERSION).toBe(manifest.version);
    expect(VERSION).toBe(pkg.version);
  });

  it("uses storage keys under the add-on's prefix", () => {
    expect(ADDON_VERSION_STORAGE_KEY).toBe("lunchmoney-addon:addon-version");
    expect(COMPANION_STORAGE_KEY).toBe("lunchmoney-addon:companion");
  });
});

describe("compareVersions", () => {
  it.each([
    ["0.7.1", "0.7.1", 0],
    ["0.7.1", "0.8.0", -1],
    ["0.10.0", "0.9.9", 1],
    ["1.0", "1.0.0", 0],
  ])("compares %s with %s", (a, b, expected) => {
    expect(Math.sign(compareVersions(a, b))).toBe(expected);
  });
});

describe("versionMismatch", () => {
  it("is null when the versions match", () => {
    expect(versionMismatch({ addon: "0.8.0", companion: "0.8.0" })).toBeNull();
  });

  it("names the older side as the one to update", () => {
    expect(versionMismatch({ addon: "0.8.0", companion: "0.7.1" })).toEqual({
      outdated: "companion",
      message:
        "The sync companion is on v0.7.1 but the add-on is on v0.8.0. Pull the latest companion image.",
    });
    expect(versionMismatch({ addon: "0.7.1", companion: "0.8.0" })).toEqual({
      outdated: "addon",
      message:
        "The add-on is on v0.7.1 but the sync companion is on v0.8.0. Install the latest add-on release.",
    });
  });
});

describe("parseCompanionInfo", () => {
  it("reads what the companion stored", () => {
    expect(
      parseCompanionInfo('{"version":"0.8.0","lastRunAt":"2026-11-07T06:00:00.000Z"}'),
    ).toEqual({ version: "0.8.0", lastRunAt: "2026-11-07T06:00:00.000Z" });
  });

  it.each([null, "", "not json", '{"lastRunAt":"x"}', "42"])("ignores %o", (raw) => {
    expect(parseCompanionInfo(raw)).toBeNull();
  });
});
