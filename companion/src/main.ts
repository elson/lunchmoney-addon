import { Cron } from "croner";
import { ConfigError, readConfig } from "./config";
import { syncOnce } from "./companionSync";
import { createRunner, exitCodeFor } from "./runner";
import { createSyncStatus, startStatusServer } from "./status";
import { WealthfolioClient } from "./wealthfolioClient";
import { VERSION } from "../../src/lib/version";

const log = (message: string) => console.log(`${new Date().toISOString()} ${message}`);

async function main(): Promise<number> {
  log(`Lunch Money sync companion v${VERSION}`);
  const config = readConfig(process.env);
  const status = createSyncStatus(VERSION);

  const run = createRunner(
    () =>
      syncOnce({
        // A fresh client each run: it signs in again, so an expired session never sticks.
        wf: new WealthfolioClient(config.wealthfolioUrl),
        password: config.password,
        fetchFn: fetch,
        now: Date.now,
        log,
        onAddonVersion: (v) => status.setAddonVersion(v),
      }),
    log,
    status,
  );

  if (config.runOnce) {
    const outcome = await run();
    return outcome ? exitCodeFor(outcome) : 0;
  }

  const server =
    config.statusPort === null ? null : await startStatusServer(config.statusPort, status);
  if (server) log(`Health check on http://0.0.0.0:${config.statusPort}/health`);

  const job = new Cron(config.schedule, { protect: true }, () => void run());
  log(`Scheduled "${config.schedule}"; next run ${job.nextRun()?.toISOString() ?? "never"}`);
  if (config.syncOnStart) await run();

  // Stop cleanly on `docker stop`.
  await new Promise<void>((resolve) => {
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.once(signal, () => {
        job.stop();
        server?.close();
        resolve();
      });
    }
  });
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    const message = err instanceof ConfigError || err instanceof Error ? err.message : String(err);
    console.error(`${new Date().toISOString()} ${message}`);
    process.exit(1);
  },
);
