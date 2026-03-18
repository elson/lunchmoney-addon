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

1. Download the latest release zip from the [Releases](../../releases) page.
2. In Wealthfolio, open **Settings → Add-ons** and install the zip.
3. The **Lunch Money** item will appear in the sidebar.
4. Open **Settings** (gear icon) and paste your Lunch Money API key.
   - Generate a token at: **Lunch Money → Settings → Developers → Request API
     Access**

### Permissions requested

| Category  | Functions              | Purpose                                 |
| --------- | ---------------------- | --------------------------------------- |
| accounts  | `getAll`, `create`     | Display and link accounts               |
| snapshots | `save`                 | Write balance snapshots                 |
| secrets   | `get`, `set`, `delete` | Store your API key securely (encrypted) |
| ui        | `sidebar.addItem`      | Add the sidebar navigation item         |

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

Once accounts are linked, click **Import Balances** on the main page. The addon
fetches the current balance for every linked Lunch Money account and saves it as
a snapshot in Wealthfolio. The "Last updated" timestamp updates automatically.

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
```

## License

MIT
