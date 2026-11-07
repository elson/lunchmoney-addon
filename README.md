# Wealthfolio Lunch Money Add-on

Synchronise your [Lunch Money](https://lunchmoney.app) cash account balances to
[Wealthfolio](https://wealthfolio.app) as point-in-time snapshots.

## Features

- **Account linking** — map Lunch Money accounts (manual and Plaid) to existing
  Wealthfolio accounts, or create new ones automatically
- **Balance sync** — import current Lunch Money balances into Wealthfolio with
  one click
- **Balance comparison** — see at a glance whether your Wealthfolio cash
  balances match Lunch Money, with visual alerts for discrepancies
- **Draft workflow** — stage any number of link changes before committing; a
  confirmation dialog shows exactly what will happen
- **Smart cleanup** — stale mappings for deleted accounts are removed
  automatically on load
- **Search & filter** — filter accounts by name, institution, or status (all /
  linked / skipped)

## Installation

Requires **Wealthfolio 3.12 or newer**.

1. Download the latest release zip from the [Releases](../../releases) page.
2. In Wealthfolio, open **Settings → Add-ons** and install the zip.
3. The **Lunch Money** item will appear in the sidebar.
4. Open **Settings** (gear icon) and paste your Lunch Money API key.
   - Generate a token at: **Lunch Money → Settings → Developers → Request API
     Access**

### Permissions requested

| Category  | Functions                       | Purpose                                                     |
| --------- | ------------------------------- | ----------------------------------------------------------- |
| accounts  | `getAll`, `create`              | Display and link accounts                                   |
| snapshots | `save`                          | Write balance snapshots                                     |
| secrets   | `get`, `set`, `delete`, `use`   | Store your API key securely and attach it to API requests   |
| portfolio | `getLatestValuations`, `update` | Compare Wealthfolio cash balances to Lunch Money            |
| network   | `request`                       | Read accounts from `api.lunchmoney.dev` (GET requests only) |

## Usage

### Linking accounts

1. Open the **Lunch Money** sidebar page — all your Lunch Money accounts are
   listed.
2. For each account, click the action menu (⇅ icon) and choose:
   - **Link to existing account** — pick a Wealthfolio holdings account from the
     dropdown
   - **Create new account** — a new cash account will be created in Wealthfolio
     on save
   - **Skip** — ignore this account
3. When you're happy with your selections, click **Save Changes**.
4. Review the confirmation dialog (lists every create / link / relink / unlink
   operation), then confirm.

### Syncing balances

Once accounts are linked, click **Sync** on the main page. The add-on reads the
current balance of every linked Lunch Money account and saves a snapshot in
Wealthfolio for each one that differs.

The add-on also syncs by itself whenever Wealthfolio opens, unless it synced in
the last hour, so balances stay current without visiting the add-on.

### Daily sync without a browser (Docker companion)

Add-ons only run while Wealthfolio is open in a browser. To sync every day
without that, run the companion container next to a self-hosted Wealthfolio
server. It makes the same calls as the **Sync** button, through Wealthfolio's
REST API, and reads its settings from the add-on: the Lunch Money token and the
account links you set up in the add-on. There is nothing to configure in the
container except how to reach Wealthfolio.

```yaml
services:
  lunchmoney-sync:
    image: ghcr.io/elson/lunchmoney-sync:latest
    restart: unless-stopped
    environment:
      - WEALTHFOLIO_URL=http://wealthfolio:8088 # Wealthfolio's service name and port
      - WEALTHFOLIO_PASSWORD_FILE=/run/secrets/wealthfolio_password
      - TZ=Europe/London # the schedule runs in this time zone
    secrets:
      - wealthfolio_password

secrets:
  wealthfolio_password:
    file: ./wealthfolio_password.txt # Wealthfolio's login password, on one line
```

| Variable                    | Default     | Meaning                                                               |
| --------------------------- | ----------- | --------------------------------------------------------------------- |
| `WEALTHFOLIO_URL`           | required    | Wealthfolio server address                                            |
| `WEALTHFOLIO_PASSWORD_FILE` | —           | File holding Wealthfolio's login password (or `WEALTHFOLIO_PASSWORD`) |
| `SYNC_SCHEDULE`             | `0 6 * * *` | Cron line for when to sync, in `TZ`                                   |
| `SYNC_ON_START`             | `true`      | Also sync when the container starts                                   |
| `RUN_ONCE`                  | `false`     | Sync once and exit (0 on success), for an external scheduler          |
| `STATUS_PORT`               | `8080`      | Port for `GET /health`; `off` for none                                |

`GET /health` returns 503, with the reason, after a failed sync (until a sync
succeeds again) or while the add-on and the companion are on different versions;
otherwise 200. The image's `HEALTHCHECK` uses it, so either problem shows the
container as unhealthy. The response holds no balances, account names or
credentials.

The add-on and the companion record their versions in the add-on's storage and
compare them: the companion logs a warning, and the add-on's main page shows
which one to update. Upgrade both together: install the add-on release and pull
the image of the same version.

The companion only reads from Lunch Money. It signs in to Wealthfolio with the
password once per run (Wealthfolio allows five sign-ins a minute) and needs a
Wealthfolio with password authentication and a single profile without a lock.

### Relinking or unlinking

Open the action menu on any linked account and select a different Wealthfolio
account (relink) or **Unlink**. Changes are staged in draft mode and only
persisted after you confirm the save dialog. Use **Undo** to discard unsaved
changes.

## Local development

```bash
# Install dependencies
pnpm install

# Watch mode — rebuilds dist/addon.js on every src/** change
pnpm dev

# Run the Wealthfolio dev server (hot-reload on ports 3001–3003)
pnpm dev:server

# One-off production build
pnpm build

# Lint, type-check, and test with coverage (≥90% thresholds enforced)
pnpm check

# Package a release zip
pnpm bundle
```

### Running tests

```bash
pnpm test            # run once
pnpm test:watch      # watch mode
pnpm test:coverage   # with V8 coverage report
```

### Project structure

```
src/
  addon.tsx          # entry point — exports enable(ctx)
  components/        # shared UI components
  hooks/             # useAccountSync — central data & save flow
  lib/               # pure utilities (lunchmoney, wealthfolio, mapping, …)
  pages/             # MainPage, SettingsPage
  test/              # setup, mockCtx, component stubs
  types/             # TypeScript interfaces
companion/           # Docker companion: daily sync over Wealthfolio's REST API
  src/main.ts        # entry point — config, schedule, health check
  Dockerfile         # built from the repo root; published to GHCR on release
```

The balance sync itself (`src/lib/balanceSync.ts`) is shared: the add-on runs it
through `ctx.api`, the companion through REST. `pnpm build:companion` builds the
companion into one script, `companion/dist/main.js`.

## License

MIT
