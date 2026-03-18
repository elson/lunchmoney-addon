# Changelog

All notable changes to the Lunch Money Add-on will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
