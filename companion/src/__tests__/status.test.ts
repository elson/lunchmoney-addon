// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createSyncStatus, startStatusServer } from "../status";

let server: Server | undefined;
afterEach(
  () => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve())),
);

async function serve(status: ReturnType<typeof createSyncStatus>) {
  server = await startStatusServer(0, status);
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

describe("createSyncStatus", () => {
  it("reports healthy with no run before the first sync", () => {
    const status = createSyncStatus("1.2.3");
    expect(status.snapshot()).toEqual({
      version: "1.2.3",
      healthy: true,
      running: false,
      lastRun: null,
      addonVersion: null,
      versionMismatch: null,
    });
  });

  it("is unhealthy while the add-on runs a different version", () => {
    const status = createSyncStatus("1.2.3");
    status.setAddonVersion("1.2.0");
    expect(status.snapshot()).toMatchObject({
      healthy: false,
      addonVersion: "1.2.0",
      versionMismatch:
        "The add-on is on v1.2.0 but the sync companion is on v1.2.3. Install the latest add-on release.",
    });

    status.setAddonVersion("1.2.3");
    expect(status.snapshot()).toMatchObject({ healthy: true, versionMismatch: null });
  });

  it("stays healthy while the add-on hasn't recorded a version", () => {
    const status = createSyncStatus("1.2.3");
    status.setAddonVersion(null);
    expect(status.snapshot().healthy).toBe(true);
  });

  it("records a run's start, finish and outcome", () => {
    const status = createSyncStatus("1.2.3");
    status.started(new Date("2026-11-07T06:00:00Z"));
    expect(status.snapshot().running).toBe(true);

    status.finished(
      { status: "synced", checked: 2, imported: 1 },
      new Date("2026-11-07T06:00:03Z"),
    );

    expect(status.snapshot()).toEqual({
      version: "1.2.3",
      healthy: true,
      running: false,
      lastRun: {
        startedAt: "2026-11-07T06:00:00.000Z",
        finishedAt: "2026-11-07T06:00:03.000Z",
        outcome: { status: "synced", checked: 2, imported: 1 },
      },
      addonVersion: null,
      versionMismatch: null,
    });
  });

  it("is unhealthy after a failed sync, and healthy again after the next success", () => {
    const status = createSyncStatus("1.2.3");
    status.started(new Date());
    status.finished({ status: "failed", errors: ["x"] }, new Date());
    expect(status.snapshot().healthy).toBe(false);

    status.started(new Date());
    status.finished({ status: "nothing-linked" }, new Date());
    expect(status.snapshot().healthy).toBe(true);
  });
});

describe("startStatusServer", () => {
  it("answers /health with 200 and the status while healthy", async () => {
    const base = await serve(createSyncStatus("1.2.3"));
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ version: "1.2.3", healthy: true });
  });

  it("answers /health with 503 after a failed sync", async () => {
    const status = createSyncStatus("1.2.3");
    status.started(new Date());
    status.finished({ status: "failed", errors: ["Lunch Money API error 401"] }, new Date());
    const base = await serve(status);

    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      healthy: false,
      lastRun: { outcome: { errors: ["Lunch Money API error 401"] } },
    });
  });

  it("answers HEAD (wget --spider) without a body", async () => {
    const base = await serve(createSyncStatus("1.2.3"));
    const res = await fetch(`${base}/health`, { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });

  it("returns 404 for anything else", async () => {
    const base = await serve(createSyncStatus("1.2.3"));
    expect((await fetch(`${base}/`)).status).toBe(404);
    expect((await fetch(`${base}/health`, { method: "POST" })).status).toBe(404);
  });

  it("answers /health with 503 when the versions differ", async () => {
    const status = createSyncStatus("1.2.3");
    status.setAddonVersion("1.0.0");
    const base = await serve(status);
    expect((await fetch(`${base}/health`)).status).toBe(503);
  });
});
