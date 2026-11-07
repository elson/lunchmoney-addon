// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ConfigError, DEFAULT_SCHEDULE, readConfig } from "../config";

const noFile = vi.fn(() => {
  throw new Error("no file");
});

describe("readConfig", () => {
  it("reads the server URL, a password file and the defaults", () => {
    const readFile = vi.fn(() => "s3cret\n");
    const config = readConfig(
      { WEALTHFOLIO_URL: "http://wealthfolio:8088", WEALTHFOLIO_PASSWORD_FILE: "/run/secrets/pw" },
      readFile,
    );
    expect(readFile).toHaveBeenCalledWith("/run/secrets/pw");
    expect(config).toEqual({
      wealthfolioUrl: "http://wealthfolio:8088",
      password: "s3cret",
      schedule: DEFAULT_SCHEDULE,
      runOnce: false,
      syncOnStart: true,
      statusPort: 8080,
    });
  });

  it("accepts the password from the environment, a custom schedule and one-shot mode", () => {
    const config = readConfig(
      {
        WEALTHFOLIO_URL: "http://wf",
        WEALTHFOLIO_PASSWORD: "pw",
        SYNC_SCHEDULE: "30 5 * * *",
        RUN_ONCE: "true",
        SYNC_ON_START: "false",
        STATUS_PORT: "9100",
      },
      noFile,
    );
    expect(config).toMatchObject({
      password: "pw",
      schedule: "30 5 * * *",
      runOnce: true,
      syncOnStart: false,
      statusPort: 9100,
    });
  });

  it("turns the status server off with STATUS_PORT=off", () => {
    const config = readConfig(
      { WEALTHFOLIO_URL: "http://wf", WEALTHFOLIO_PASSWORD: "pw", STATUS_PORT: "off" },
      noFile,
    );
    expect(config.statusPort).toBeNull();
  });

  it("rejects a STATUS_PORT that isn't a port", () => {
    expect(() =>
      readConfig(
        { WEALTHFOLIO_URL: "http://wf", WEALTHFOLIO_PASSWORD: "pw", STATUS_PORT: "abc" },
        noFile,
      ),
    ).toThrow('STATUS_PORT must be a port number or "off", not "abc"');
  });

  it("requires the server URL", () => {
    expect(() => readConfig({ WEALTHFOLIO_PASSWORD: "pw" }, noFile)).toThrow(
      new ConfigError("Set WEALTHFOLIO_URL to Wealthfolio's address, e.g. http://wealthfolio:8088"),
    );
  });

  it("requires a password", () => {
    expect(() => readConfig({ WEALTHFOLIO_URL: "http://wf" }, noFile)).toThrow(
      "Set WEALTHFOLIO_PASSWORD_FILE (or WEALTHFOLIO_PASSWORD) to Wealthfolio's login password",
    );
  });

  it("names a password file it can't read", () => {
    expect(() =>
      readConfig({ WEALTHFOLIO_URL: "http://wf", WEALTHFOLIO_PASSWORD_FILE: "/x" }, noFile),
    ).toThrow("Can't read WEALTHFOLIO_PASSWORD_FILE /x");
  });

  it("rejects an empty password file", () => {
    expect(() =>
      readConfig({ WEALTHFOLIO_URL: "http://wf", WEALTHFOLIO_PASSWORD_FILE: "/x" }, () => "  \n"),
    ).toThrow("WEALTHFOLIO_PASSWORD_FILE /x is empty");
  });
});
