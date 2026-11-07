# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Commands

```bash
pnpm dev            # Watch mode build (rebuilds on src/** changes)
pnpm dev:server     # Run Wealthfolio dev server (hot-reload on ports 3001-3003)
pnpm build          # One-off production build → dist/addon.js
pnpm lint           # ESLint (excludes test/coverage dirs)
pnpm type-check     # tsc --noEmit
pnpm test           # Run tests once (Vitest)
pnpm test:watch     # Run tests in watch mode
pnpm test:coverage  # Run tests with V8 coverage report (≥90% thresholds enforced)
pnpm bundle         # Full release: clean → build → zip package
```

## Architecture

This is a **Wealthfolio addon** that syncs Lunch Money accounts to Wealthfolio
holdings. The addon is distributed as a single bundled ES module
(`dist/addon.js`).

**Entry point**: `src/addon.tsx` exports a default `enable(ctx: AddonContext)`
function. This is the only function Wealthfolio calls — it receives an
`AddonContext` that exposes the full SDK surface.

**Build**: Vite library mode, output format `es`. The addon runs in a sandboxed
iframe (Wealthfolio ≥ 3.6). Host-provided packages (React, `@wealthfolio/ui`,
`@wealthfolio/addon-sdk`, `date-fns`, …) are ESM `external` in `vite.config.ts`
and must match `hostDependencies` in `manifest.json`. Tailwind CSS v4 is
available for UI.

**Sandbox rules**: `fetch` is blocked — call external APIs via
`ctx.api.network.request` (host listed in `manifest.json`
`network.allowedHosts`). `localStorage` throws — persist with async
`ctx.api.storage` (get/set/delete). `@wealthfolio/ui` is built on Base UI (not
Radix): use `render` instead of `asChild`, `onClick` on `DropdownMenuItem`,
array values on `ToggleGroup`.

**Styling**: the sandbox's base stylesheet is the host's Tailwind build, which
only has utilities Wealthfolio itself uses. `src/addon.css` generates the
addon's utilities into `dist/addon.css` (no reset, no theme variables; colours
map to the host's CSS variables). Use theme colours (`text-success`,
`text-warning`, `text-destructive`, `text-muted-foreground`), not Tailwind's
palette — `src/__tests__/stylesheet.test.ts` enforces this. A new theme colour
must be added to the `@theme inline reference` block in `src/addon.css`.

**Folder conventions**:

- `src/components/` — shared UI components
- `src/hooks/` — custom React hooks (e.g. `useAccountSync` for data loading and
  save flow)
- `src/lib/` — pure utilities and API modules (see below)
- `src/pages/` — full page components registered via `ctx.router.add`
- `src/test/` — test infrastructure: `setup.ts`, `mockCtx.ts`, `mocks/`
- `src/types/` — TypeScript interfaces

**Library modules** (`src/lib/`):

- `lunchmoney.ts` — Lunch Money API types and fetch functions. Extend here for
  new LM endpoints.
- `wealthfolio.ts` — Wealthfolio account creation helpers. Extend here for new
  WF operations.
- `secrets.ts` — Secret key constants (`API_KEY_SECRET`, `MAPPING_SECRET_KEY`).
  All secret keys in one place.
- `mapping.ts` — Account mapping domain logic: serialize/deserialize, equality,
  stale cleanup, claimed IDs. Pure functions, no React.
- `classifyChanges.ts` — Classifies draft vs saved mapping into
  create/link/relink/unlink/unchanged buckets. Pure function, no React.
- `filterAccounts.ts` — Filters LM accounts by search query and tab. Pure
  function, no React.
- `balanceSync.ts` — the balance sync shared by the add-on and the companion:
  `BalanceSyncHost` (what a sync needs), `importChangedBalances`,
  `runBalanceSync`. No `ctx`; keep it free of add-on-only imports.
- `addonHost.ts` — `BalanceSyncHost` over `ctx.api`.
- `autoSync.ts` — sync when Wealthfolio opens (one-hour cooldown), called from
  `enable()`.
- `balances.ts` — `balancesMatch` (half-cent tolerance), shared by the view
  model and sync engine.
- `format.ts` — `formatMoney` for ISO currency amounts.
- `routes.ts` — route ids/paths; must match `manifest.json` `contributes`.

## Companion (`companion/`)

A Node container that runs `runBalanceSync` on a cron schedule over
Wealthfolio's REST API (`/api/v1`: password login → `wf_session` token as
Bearer; reads the add-on's secret `/addons/<id>/secrets?key=` and storage
`/addons/storage/<id>/<key>`). It imports shared code from `src/lib/`, so
anything it imports must not need `ctx` or the browser. `pnpm build:companion`
bundles it (croner included) into `companion/dist/main.js`; the release workflow
publishes the image to GHCR. Its tests are in `companion/src/__tests__/` (Node
environment) and count towards coverage; `main.ts` is excluded.

## Testing

Tests live in `src/**/__tests__/` alongside the code they cover. The test setup
is in `src/test/`:

- `setup.ts` — imports `@testing-library/jest-dom` matchers
- `mockCtx.ts` — `createMockCtx()` factory that returns a fully-typed
  `AddonContext` mock
- `mocks/wealthfolio-ui.tsx` — passthrough stubs for `@wealthfolio/ui`
  components (aliased in via `vite.config.ts` `test.alias`)

**Coverage thresholds** (enforced by `pnpm test:coverage`): 90% lines, branches,
functions, statements. Excluded: `src/addon.tsx`, `src/types/**`,
`src/lib/secrets.ts`, `src/**/index.ts`.

### TDD workflow

Always follow red → green → refactor:

1. **Red** — write a failing test that captures the desired behaviour before
   touching any production code. Confirm it fails for the right reason.
2. **Green** — write the minimum production code needed to make the test pass.
   No more.
3. **Refactor** — clean up while keeping all tests green.

Never write production code without a failing test driving it first.

## AddonContext API

```typescript
interface AddonContext {
  sidebar: SidebarAPI;
  router: RouterAPI;
  onDisable(fn: () => void): void;
  api: {
    accounts;
    portfolio;
    activities;
    market;
    assets;
    quotes;
    performance;
    exchangeRates;
    goals;
    contributionLimits;
    settings;
    files;
    events;
    secrets;
    logger;
    query;
  };
}
```

### Routes & Sidebar

Routes and the sidebar link are declared in `manifest.json` `contributes`; the
host mounts them at `/addons/<manifest.id>[/<path>]`. Route ids and paths live
in `src/lib/routes.ts` and must match the manifest (enforced by
`routes.test.ts`). `enable()` only attaches components:

```typescript
ctx.router.add({ ...MAIN_ROUTE, component: Main }); // host owns the React root

// Programmatic navigation
ctx.api.navigation.navigate(SETTINGS_ROUTE.path); // or /accounts, /portfolio, …
```

Sidebar icons are a curated string set (`AddonIconName`), not React nodes.

### Key API Methods

**Accounts** (`accounts.getAll`, `accounts.create`)

```typescript
ctx.api.accounts.getAll() → Promise<Account[]>
ctx.api.accounts.create(account: AccountCreate) → Promise<Account>
```

**Portfolio**

```typescript
ctx.api.portfolio.getHoldings(accountId) → Promise<Holding[]>
ctx.api.portfolio.getHolding(accountId, assetId) → Promise<Holding | null>
ctx.api.portfolio.update() → Promise<void>        // trigger portfolio update
ctx.api.portfolio.recalculate() → Promise<void>   // force full recalculation
ctx.api.portfolio.getHistoricalValuations(accountId?, startDate?, endDate?) → Promise<AccountValuation[]>
ctx.api.portfolio.getLatestValuations(accountIds[]) → Promise<AccountValuation[]>
ctx.api.portfolio.getIncomeSummary() → Promise<IncomeSummary[]>
```

**Activities**

```typescript
ctx.api.activities.getAll(accountId?) → Promise<ActivityDetails[]>
ctx.api.activities.create(activity) → Promise<Activity>
ctx.api.activities.saveMany(activities[]) → Promise<Activity[]>  // batch, single transaction
ctx.api.activities.import(activities[]) → Promise<ActivityImport[]>  // with duplicate detection
ctx.api.activities.checkImport(accountId, activities[]) → Promise<ActivityImport[]>
ctx.api.activities.delete(activityId) → Promise<void>
```

Activity types:
`BUY | SELL | DIVIDEND | INTEREST | DEPOSIT | WITHDRAWAL | TRANSFER_IN | TRANSFER_OUT | FEE | TAX`

**Secrets** (encrypted, scoped to this addon's ID)

```typescript
ctx.api.secrets.set(key, value) → Promise<void>
ctx.api.secrets.get(key) → Promise<string | null>
ctx.api.secrets.delete(key) → Promise<void>
```

**Files**

```typescript
ctx.api.files.openCsvDialog() → Promise<null | string | string[]>
ctx.api.files.openSaveDialog(fileContent, fileName) → Promise<any>
```

**Logger**

```typescript
ctx.api.logger.info(msg)
ctx.api.logger.error(msg)
ctx.api.logger.warn(msg) / .debug(msg) / .trace(msg)
```

**React Query integration** — shares the host app's QueryClient:

```typescript
ctx.api.query.getClient() → QueryClient
ctx.api.query.invalidateQueries(queryKey)
ctx.api.query.refetchQueries(queryKey)
```

**Events** (all return `Promise<UnlistenFn>` — unsubscribe in `onDisable`):

```typescript
ctx.api.events.onUpdateComplete(cb); // portfolio update done
ctx.api.events.onSyncComplete(cb); // market sync done
ctx.api.events.onDrop(cb); // file drag-and-drop
```

### Permissions

Declared in `manifest.json` under `"permissions"`. Add a permission entry before
using any new API category — Wealthfolio performs static analysis on install and
blocks unauthorized calls at runtime with `PermissionError`.

Risk levels: **High** (accounts, portfolio, activities, secrets) · **Medium**
(assets, performance, goals, settings, files) · **Low** (market-data, quotes,
events)

## Lunch Money V2 API

> **IMPORTANT: This addon must ONLY read from the Lunch Money API. Never
> implement any POST, PUT, PATCH, or DELETE calls. Do not create, modify, or
> delete any Lunch Money data under any circumstances.**

**Base URL**: `https://api.lunchmoney.dev/v2` **Auth**:
`Authorization: Bearer <api_key>` (stored in secrets under key
`lunchmoney-api-key`) **Docs UI**: https://alpha.lunchmoney.dev/v2/docs (Scalar,
rendered in browser — not machine-readable directly) **OpenAPI spec**
(machine-readable YAML, ~350 KB):

```bash
curl -s https://alpha.lunchmoney.dev/v2/openapi
```

### Key endpoints used by this addon

```
GET /manual_accounts   → { manual_accounts: ManualAccount[] }
GET /plaid_accounts    → { plaid_accounts: PlaidAccount[] }
```

Both account types share these relevant fields:

```typescript
{
  id: number
  name: string
  display_name: string | null   // prefer over name if set
  type: string                  // e.g. "cash", "credit", "investment"
  currency: string              // lowercase ISO, e.g. "usd"
  balance: string               // decimal string, e.g. "1234.5600"
  to_base: number               // balance converted to user's base currency
  status: string                // "active" | "inactive" | "closed"
  institution_name?: string
}
```

Fetch logic lives in `src/lib/lunchmoney.ts` (via `ctx.api.network.request` with
`auth: { type: "bearer", secretKey }` — the broker injects the key) — extend it
for new endpoints rather than adding fetch calls inline. Wealthfolio account
operations live in `src/lib/wealthfolio.ts`.

### Cleanup pattern

Always unsubscribe event listeners and remove sidebar items in `onDisable`:

```typescript
export default function enable(ctx: AddonContext) {
  const item = ctx.sidebar.addItem({ ... });

  let unlisten: (() => void) | undefined;
  ctx.api.events.onUpdateComplete(handleUpdate).then(fn => { unlisten = fn; });

  ctx.onDisable(() => {
    item.remove();
    unlisten?.();
  });
}
```
