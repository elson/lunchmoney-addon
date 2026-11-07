// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { WealthfolioClient, WealthfolioError } from "../wealthfolioClient";

type Call = { url: string; method: string; headers: Record<string, string>; body?: unknown };

/** A fetch that answers from a table keyed by "METHOD path" and records every call. */
function fakeFetch(routes: Record<string, () => Response>) {
  const calls: Call[] = [];
  const fn = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    calls.push({
      url: url.pathname + url.search,
      method,
      headers: Object.fromEntries(new Headers(init.headers).entries()),
      body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
    });
    const route = routes[`${method} ${url.pathname}`];
    return route ? route() : new Response("not found", { status: 404 });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });

const loggedIn = {
  "POST /api/v1/auth/login": () =>
    json(
      { authenticated: true, expiresIn: 3600 },
      { headers: { "set-cookie": "wf_session=tok123; HttpOnly; Path=/api" } },
    ),
};

async function signedInClient(routes: Record<string, () => Response>) {
  const fake = fakeFetch({ ...loggedIn, ...routes });
  const client = new WealthfolioClient("http://wf:8088/", fake.fn);
  await client.login("pw");
  return { client, calls: fake.calls };
}

describe("WealthfolioClient", () => {
  it("signs in with the password and sends the session token as a bearer token", async () => {
    const { client, calls } = await signedInClient({
      "GET /api/v1/accounts": () => json([{ id: "w1" }]),
    });

    await client.getAccountIds();

    expect(calls[0]).toMatchObject({
      url: "/api/v1/auth/login",
      method: "POST",
      body: { password: "pw" },
    });
    expect(calls[1].headers.authorization).toBe("Bearer tok123");
  });

  it("explains a rejected password", async () => {
    const fake = fakeFetch({
      "POST /api/v1/auth/login": () => new Response("", { status: 401 }),
    });
    const client = new WealthfolioClient("http://wf:8088", fake.fn);
    await expect(client.login("bad")).rejects.toThrow(
      "Wealthfolio rejected the password (HTTP 401)",
    );
  });

  it("fails clearly when the login response has no session cookie", async () => {
    const fake = fakeFetch({ "POST /api/v1/auth/login": () => json({ authenticated: true }) });
    const client = new WealthfolioClient("http://wf:8088", fake.fn);
    await expect(client.login("pw")).rejects.toThrow("no wf_session cookie");
  });

  it("lists account ids as strings", async () => {
    const { client } = await signedInClient({
      "GET /api/v1/accounts": () => json([{ id: "w1" }, { id: 7 }]),
    });
    expect(await client.getAccountIds()).toEqual(["w1", "7"]);
  });

  it("reads latest cash balances for the given accounts, accepting decimal strings", async () => {
    const { client, calls } = await signedInClient({
      "GET /api/v1/valuations/latest": () =>
        json([
          { accountId: "w1", cashBalance: "12.50" },
          { accountId: "w2", cashBalance: 3 },
        ]),
    });

    expect(await client.getLatestCashBalances(["w1", "w2"])).toEqual({ w1: 12.5, w2: 3 });
    expect(calls.at(-1)?.url).toBe("/api/v1/valuations/latest?accountIds=w1&accountIds=w2");
  });

  it("asks for no valuations when there are no accounts", async () => {
    const { client, calls } = await signedInClient({});
    expect(await client.getLatestCashBalances([])).toEqual({});
    expect(calls).toHaveLength(1);
  });

  it("saves a cash-only snapshot", async () => {
    const { client, calls } = await signedInClient({
      "POST /api/v1/snapshots": () => new Response(null, { status: 204 }),
    });

    await client.saveCashSnapshot("w1", "GBP", "10.00", "2026-11-07");

    expect(calls.at(-1)).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: {
        accountId: "w1",
        holdings: [],
        cashBalances: { GBP: "10.00" },
        snapshotDate: "2026-11-07",
      },
    });
  });

  it("asks Wealthfolio to update the portfolio", async () => {
    const { client, calls } = await signedInClient({
      "POST /api/v1/portfolio/update": () => new Response(null, { status: 202 }),
    });
    await client.updatePortfolio();
    expect(calls.at(-1)).toMatchObject({ url: "/api/v1/portfolio/update", method: "POST" });
  });

  it("reads one of an add-on's secrets", async () => {
    const { client, calls } = await signedInClient({
      "GET /api/v1/addons/lunchmoney-addon/secrets": () => json("lm-token"),
    });
    expect(await client.getAddonSecret("lunchmoney-addon", "lunchmoney-api-key")).toBe("lm-token");
    expect(calls.at(-1)?.url).toBe(
      "/api/v1/addons/lunchmoney-addon/secrets?key=lunchmoney-api-key",
    );
  });

  it("reads and writes an add-on's storage, escaping the key", async () => {
    const { client, calls } = await signedInClient({
      "GET /api/v1/addons/storage/lunchmoney-addon/lunchmoney-addon%3Aaccount-mapping": () =>
        json('{"1":{"type":"ignore"}}'),
      "PUT /api/v1/addons/storage/lunchmoney-addon/lunchmoney-addon%3Alast-synced": () =>
        new Response(null, { status: 204 }),
    });

    expect(
      await client.getAddonStorage("lunchmoney-addon", "lunchmoney-addon:account-mapping"),
    ).toBe('{"1":{"type":"ignore"}}');
    await client.setAddonStorage("lunchmoney-addon", "lunchmoney-addon:last-synced", "123");
    expect(calls.at(-1)).toMatchObject({ method: "PUT", body: { value: "123" } });
  });

  it("returns null for a missing secret or storage item", async () => {
    const { client } = await signedInClient({
      "GET /api/v1/addons/a/secrets": () => json(null),
      "GET /api/v1/addons/storage/a/k": () => json(null),
    });
    expect(await client.getAddonSecret("a", "k")).toBeNull();
    expect(await client.getAddonStorage("a", "k")).toBeNull();
  });

  it("reports a failed request with its method, path and status, but not its body", async () => {
    const { client } = await signedInClient({
      "POST /api/v1/snapshots": () => new Response("account lm-secret locked", { status: 500 }),
    });
    const err = await client.saveCashSnapshot("w1", "USD", "1", "2026-11-07").catch((e) => e);
    expect(err).toBeInstanceOf(WealthfolioError);
    expect(err.message).toBe("Wealthfolio POST /api/v1/snapshots failed (HTTP 500)");
    expect(err.status).toBe(500);
  });
});
