import { createServer, type Server } from "node:http";
import type { BalanceSyncOutcome } from "../../src/lib/balanceSync";
import { versionMismatch } from "../../src/lib/version";

export interface StatusSnapshot {
  version: string;
  /** False after a failed sync (until one succeeds), or while the add-on runs another version. */
  healthy: boolean;
  running: boolean;
  lastRun: { startedAt: string; finishedAt: string; outcome: BalanceSyncOutcome } | null;
  /** The add-on's version as it last recorded it; null until known. */
  addonVersion: string | null;
  /** What to update when the add-on and companion differ. */
  versionMismatch: string | null;
}

export interface SyncStatus {
  started(at: Date): void;
  finished(outcome: BalanceSyncOutcome, at: Date): void;
  setAddonVersion(version: string | null): void;
  snapshot(): StatusSnapshot;
}

/**
 * The companion's own record of its runs, for the health check. It holds no
 * amounts, account names or credentials: errors are the sync's own messages,
 * which name a call and an HTTP status, never a response body.
 */
export function createSyncStatus(version: string): SyncStatus {
  let startedAt: Date | null = null;
  let running = false;
  let lastRun: StatusSnapshot["lastRun"] = null;
  let addonVersion: string | null = null;
  return {
    started(at) {
      startedAt = at;
      running = true;
    },
    finished(outcome, at) {
      running = false;
      lastRun = {
        startedAt: (startedAt ?? at).toISOString(),
        finishedAt: at.toISOString(),
        outcome,
      };
    },
    setAddonVersion(v) {
      addonVersion = v;
    },
    snapshot: () => {
      const mismatch = addonVersion
        ? (versionMismatch({ addon: addonVersion, companion: version })?.message ?? null)
        : null;
      return {
        version,
        healthy: lastRun?.outcome.status !== "failed" && mismatch === null,
        running,
        lastRun,
        addonVersion,
        versionMismatch: mismatch,
      };
    },
  };
}

/** Serves `GET /health` (and HEAD, for `wget --spider`): 200 while healthy, 503 otherwise. */
export function startStatusServer(port: number, status: SyncStatus): Promise<Server> {
  const server = createServer((req, res) => {
    if (req.url !== "/health" || (req.method !== "GET" && req.method !== "HEAD")) {
      res.writeHead(404).end();
      return;
    }
    const snapshot = status.snapshot();
    res.writeHead(snapshot.healthy ? 200 : 503, { "Content-Type": "application/json" });
    res.end(req.method === "HEAD" ? undefined : JSON.stringify(snapshot));
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => resolve(server));
  });
}
