# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Watch mode build (rebuilds on src/** changes)
pnpm dev:server   # Run Wealthfolio dev server (hot-reload on ports 3001-3003)
pnpm build        # One-off production build → dist/addon.js
pnpm lint         # Type-check only (tsc --noEmit, no test runner)
pnpm bundle       # Full release: clean → build → zip package
```

## Architecture

This is a **Wealthfolio addon** that syncs Lunch Money accounts to Wealthfolio holdings. The addon is distributed as a single bundled ES module (`dist/addon.js`).

**Entry point**: `src/addon.tsx` exports a default `enable(ctx: AddonContext)` function. This is the only function Wealthfolio calls — it receives an `AddonContext` that exposes the full SDK surface.

**Build**: Vite library mode, output format `es`. React and ReactDOM are external globals (not bundled) — the host app provides them. `@wealthfolio/ui` components and Tailwind CSS v4 are available for UI.

**Folder conventions**:
- `src/components/` — shared UI components
- `src/hooks/` — custom React hooks (e.g. `useAccountSync` for data loading and save flow)
- `src/lib/` — pure utilities and API modules (see below)
- `src/pages/` — full page components registered via `ctx.router.add`
- `src/types/` — TypeScript interfaces

**Library modules** (`src/lib/`):
- `lunchmoney.ts` — Lunch Money API types and fetch functions. Extend here for new LM endpoints.
- `wealthfolio.ts` — Wealthfolio account creation helpers. Extend here for new WF operations.
- `secrets.ts` — Secret key constants (`API_KEY_SECRET`, `MAPPING_SECRET_KEY`). All secret keys in one place.
- `mapping.ts` — Account mapping domain logic: serialize/deserialize, equality, stale cleanup, claimed IDs. Pure functions, no React.

## AddonContext API

```typescript
interface AddonContext {
  sidebar: SidebarAPI;
  router: RouterAPI;
  onDisable(fn: () => void): void;
  api: {
    accounts, portfolio, activities, market, assets,
    quotes, performance, exchangeRates, goals,
    contributionLimits, settings, files, events, secrets, logger, query
  };
}
```

### Sidebar & Router

```typescript
// Register a sidebar nav item
const item = ctx.sidebar.addItem({ id, label, route, icon?, order });
item.remove(); // call in onDisable

// Register a route
ctx.router.add({ path: '/addon/my-addon', component: React.lazy(...) });

// Programmatic navigation
ctx.api.events.navigate('/accounts'); // or /portfolio, /activities, /goals, /settings
```

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
Activity types: `BUY | SELL | DIVIDEND | INTEREST | DEPOSIT | WITHDRAWAL | TRANSFER_IN | TRANSFER_OUT | FEE | TAX`

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
ctx.api.events.onUpdateComplete(cb)   // portfolio update done
ctx.api.events.onSyncComplete(cb)     // market sync done
ctx.api.events.onDrop(cb)             // file drag-and-drop
```

### Permissions

Declared in `manifest.json` under `"permissions"`. Add a permission entry before using any new API category — Wealthfolio performs static analysis on install and blocks unauthorized calls at runtime with `PermissionError`.

Risk levels: **High** (accounts, portfolio, activities, secrets) · **Medium** (assets, performance, goals, settings, files) · **Low** (market-data, quotes, events)

## Lunch Money V2 API

> **IMPORTANT: This addon must ONLY read from the Lunch Money API. Never implement any POST, PUT, PATCH, or DELETE calls. Do not create, modify, or delete any Lunch Money data under any circumstances.**

**Base URL**: `https://api.lunchmoney.dev/v2`
**Auth**: `Authorization: Bearer <api_key>` (stored in secrets under key `lunchmoney-api-key`)
**Docs UI**: https://alpha.lunchmoney.dev/v2/docs (Scalar, rendered in browser — not machine-readable directly)
**OpenAPI spec** (machine-readable YAML, ~350 KB):
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

Fetch logic lives in `src/lib/lunchmoney.ts` — extend it for new endpoints rather than adding fetch calls inline. Wealthfolio account operations live in `src/lib/wealthfolio.ts`.

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
