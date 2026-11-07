/** Every day at 06:00 in the container's time zone (`TZ`). */
export const DEFAULT_SCHEDULE = "0 6 * * *";

export interface CompanionConfig {
  wealthfolioUrl: string;
  password: string;
  /** A cron line, in the container's time zone. */
  schedule: string;
  /** Sync once and exit, for an external scheduler (host cron, a Kubernetes CronJob). */
  runOnce: boolean;
  /** Also sync as soon as the container starts. */
  syncOnStart: boolean;
  /** Port for the `/health` endpoint, or null for none. */
  statusPort: number | null;
}

export const DEFAULT_STATUS_PORT = 8080;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

type Env = Record<string, string | undefined>;

function readPassword(env: Env): string {
  if (env.WEALTHFOLIO_PASSWORD_FILE) {
    throw new ConfigError(
      "WEALTHFOLIO_PASSWORD_FILE is no longer supported: set WEALTHFOLIO_PASSWORD to Wealthfolio's login password instead",
    );
  }
  if (env.WEALTHFOLIO_PASSWORD) return env.WEALTHFOLIO_PASSWORD;
  throw new ConfigError("Set WEALTHFOLIO_PASSWORD to Wealthfolio's login password");
}

export function readConfig(env: Env): CompanionConfig {
  const wealthfolioUrl = env.WEALTHFOLIO_URL;
  if (!wealthfolioUrl) {
    throw new ConfigError(
      "Set WEALTHFOLIO_URL to Wealthfolio's address, e.g. http://wealthfolio:8088",
    );
  }
  return {
    wealthfolioUrl,
    password: readPassword(env),
    schedule: env.SYNC_SCHEDULE || DEFAULT_SCHEDULE,
    runOnce: env.RUN_ONCE === "true",
    syncOnStart: env.SYNC_ON_START !== "false",
    statusPort: readStatusPort(env.STATUS_PORT),
  };
}

function readStatusPort(raw: string | undefined): number | null {
  if (!raw) return DEFAULT_STATUS_PORT;
  if (raw === "off") return null;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError(`STATUS_PORT must be a port number or "off", not "${raw}"`);
  }
  return port;
}
