# Changelog

All notable changes to the Lunch Money Add-on will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The add-on syncs linked balances by itself whenever Wealthfolio opens, unless
  it synced in the last hour.
- A Docker companion (`ghcr.io/elson/lunchmoney-sync`) syncs every day without a
  browser, using the add-on's own token and account links, with a `/health`
  endpoint that turns unhealthy when a sync fails.
- The add-on and the companion check they run the same release: the add-on shows
  a warning naming the one to update, and the companion's health check fails
  until they match.

## [0.7.1] - 2026-11-07

### Fixed

- The "Lunch Money" column label lines up with the status icons instead of being
  indented

## [0.7.0] - 2026-11-07

### Added

- Wealthfolio balances refresh automatically every few seconds while the page is
  open
- Centred call-to-action screens when no token is set, nothing is linked yet, or
  Lunch Money has no accounts

### Changed

- The accounts table labels the Lunch Money and Wealthfolio sides, shows each
  side's balance, and marks linked accounts "In sync" or how much higher or
  lower Wealthfolio is
- The accounts list opens on Linked once any account is linked
- The linking wizard pre-selects the suggested account, or Skip if there's none;
  matching zero balances no longer count as a suggestion
- Lunch Money credit cards are no longer shown — Wealthfolio can't take their
  balance
- The settings card is centred on the page

### Fixed

- A row's Wealthfolio balance now follows the account chosen in the dropdown

## [0.6.0] - 2026-11-07

### Added

- Guided linking: step through each Lunch Money account, see its balance next to
  each Wealthfolio account's, pick one (suggestions shown), create one, or skip;
  then review every change — links, new accounts, skips and balance imports —
  before anything is saved. Offered automatically until accounts are linked, and
  from **Link accounts** afterwards
- Settings shows whether the token works (budget and user name), never displays
  the saved token, can reveal the token being typed, and asks before removing it

### Changed

- **Sync** replaces the separate Refresh and Import Balances buttons: it fetches
  from Lunch Money and imports only the balances that changed, then reports what
  it did ("2 balances updated" / "all balances up to date")

### Fixed

- Don't allow linking a Lunch Money account to a Wealthfolio account in another
  currency (the import would write e.g. a euro balance into a pound account).
  The guided flow shows such accounts as unavailable; the table no longer offers
  them

## [0.5.0] - 2026-11-07

### Added

- Show each account's Lunch Money balance, and once linked, whether it matches
  Wealthfolio (with the Wealthfolio balance and difference when it doesn't)
- Label accounts as Manual or Synced so look-alike accounts can be told apart

### Changed

- Click anywhere on the target account to change it; a linked account has its
  own button to open it in Wealthfolio
- Show the original account name only when it adds information
- Use the theme's success and warning colours for balance status

### Fixed

- Ship the addon's own stylesheet: in Wealthfolio's sandbox, layout classes the
  host doesn't use had no styles (overlapping search icon, missing spacing, no
  selected filter tab)

## [0.4.1] - 2026-11-07

### Fixed

- Declare the `secrets.use` permission so Wealthfolio can attach the API key to
  Lunch Money requests (0.4.0 failed with "tried to use 'network.request'
  without permission")

## [0.4.0] - 2026-11-07

### Changed

- **Breaking:** require Wealthfolio 3.12+ (SDK and UI 3.12). The addon now runs
  in Wealthfolio's sandboxed iframe: routes and the sidebar link are declared in
  the manifest and served under `/addons/lunchmoney-addon`
- Call the Lunch Money API through the host network broker (new `network`
  permission for `api.lunchmoney.dev`); the API key is injected by the host
- Persist account mappings and last-sync time in Wealthfolio addon storage
  instead of `localStorage` (unavailable in the sandbox). Mappings saved by
  earlier versions in `localStorage` cannot be read and must be re-linked
- Migrate to Base UI components (`render` triggers, `Empty` empty state,
  array-valued `ToggleGroup`)
- Drop the `navigation`, `logger` and `ui` permission entries (now baseline)

## [0.3.4] - 2026-03-19

### Added

- Introduce AccountViewModel to unify derived account state
- Deepen AccountViewModel by absorbing classifyChanges and filterAccounts

### Changed

- Extract SyncEngine from useAccountSync to enable plain async testing
- Encapsulate API key secret and collapse useAccountSync state

## [0.3.3] - 2026-03-18

### Fixed

- Refresh balance cards after Import Balances completes

## [0.3.2] - 2026-03-18

### Added

- Declare all Wealthfolio API permissions used by the addon in manifest.json
  (portfolio, navigation, logger, router.add, onDisable)

### Changed

- Rewrote README with full feature descriptions, installation steps, usage
  workflows, and local development guide
- Added MIT LICENSE file

## [0.3.1] - 2026-03-18

### Fixed

- Refresh balance cards after Import Balances completes by triggering
  portfolio.update() before reloading valuations

## [0.3.0] - 2026-03-18

### Added

- Vitest test suite with ≥90% coverage enforced across all lib and hook modules
- Link Wealthfolio account names to their account details view

### Fixed

- Release Wealthfolio accounts locked by deleted Lunch Money accounts
- Prevent EmptyPlaceholder flash on load; clarify page headings

## [0.2.0] - 2026-03-18

### Added

- Account search and status filter tabs (all / linked / skipped) on main view

## [0.1.0] - 2026-03-18

### Added

- Initial release: accounts listing and mapping UX
- Fetch and display all Lunch Money manual and Plaid accounts
- Link Lunch Money accounts to existing Wealthfolio accounts or create new ones
- Balance sync — import Lunch Money balances as Wealthfolio snapshots
- Balance comparison indicator with mismatch alerts
- Draft workflow with confirmation dialog before saving changes
- Undo support to revert unsaved mapping changes
- Stale mapping cleanup on load
- Secure API key storage via Wealthfolio encrypted secrets
- Sidebar navigation integration
