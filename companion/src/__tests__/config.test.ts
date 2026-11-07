// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ConfigError, DEFAULT_SCHEDULE, readConfig } from "../config";

describe("readConfig", () => {
  it("reads the server URL, the password and the defaults", () => {
    const config = readConfig({
      WEALTHFOLIO_URL: "http://wealthfolio:8088",
      WEALTHFOLIO_PASSWORD: "s3cret",
    });
    expect(config).toEqual({
      wealthfolioUrl: "http://wealthfolio:8088",
      password: "s3cret",
      schedule: DEFAULT_SCHEDULE,
      runOnce: false,
      syncOnStart: true,
      statusPort: 8080,
    });
  });

  it("accepts a custom schedule, one-shot mode and status port", () => {
    const config = readConfig({
      WEALTHFOLIO_URL: "http://wf",
      WEALTHFOLIO_PASSWORD: "pw",
      SYNC_SCHEDULE: "30 5 * * *",
      RUN_ONCE: "true",
      SYNC_ON_START: "false",
      STATUS_PORT: "9100",
    });
    expect(config).toMatchObject({
      password: "pw",
      schedule: "30 5 * * *",
      runOnce: true,
      syncOnStart: false,
      statusPort: 9100,
    });
  });

  it("turns the status server off with STATUS_PORT=off", () => {
    const config = readConfig({
      WEALTHFOLIO_URL: "http://wf",
      WEALTHFOLIO_PASSWORD: "pw",
      STATUS_PORT: "off",
    });
    expect(config.statusPort).toBeNull();
  });

  it("rejects a STATUS_PORT that isn't a port", () => {
    expect(() =>
      readConfig({ WEALTHFOLIO_URL: "http://wf", WEALTHFOLIO_PASSWORD: "pw", STATUS_PORT: "abc" }),
    ).toThrow('STATUS_PORT must be a port number or "off", not "abc"');
  });

  it("requires the server URL", () => {
    expect(() => readConfig({ WEALTHFOLIO_PASSWORD: "pw" })).toThrow(
      new ConfigError("Set WEALTHFOLIO_URL to Wealthfolio's address, e.g. http://wealthfolio:8088"),
    );
  });

  it("requires a password", () => {
    expect(() => readConfig({ WEALTHFOLIO_URL: "http://wf" })).toThrow(
      "Set WEALTHFOLIO_PASSWORD to Wealthfolio's login password",
    );
  });

  it("tells a 0.8.0 setup that the password file is no longer read", () => {
    expect(() =>
      readConfig({ WEALTHFOLIO_URL: "http://wf", WEALTHFOLIO_PASSWORD_FILE: "/run/secrets/pw" }),
    ).toThrow(
      "WEALTHFOLIO_PASSWORD_FILE is no longer supported: set WEALTHFOLIO_PASSWORD to Wealthfolio's login password instead",
    );
  });
});
