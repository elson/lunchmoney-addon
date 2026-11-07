import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountLinkTable } from "../AccountLinkTable";
import { buildAccountViewModel } from "../../lib/accountViewModel";
import type { LunchmoneyAccount } from "../../lib/lunchmoney";
import type { Account } from "@wealthfolio/addon-sdk";
import type { AccountMapping } from "../../types";

const lm = (id: number, name: string, institution?: string): LunchmoneyAccount => ({
  id,
  name,
  display_name: null,
  type: "cash",
  subtype: null,
  currency: "usd",
  balance: "100.00",
  status: "active",
  institution_name: institution,
});

const wf = (id: string, name: string): Account =>
  ({
    id,
    name,
    accountType: "CASH",
    currency: "USD",
    isDefault: false,
    isActive: true,
    trackingMode: "HOLDINGS",
  }) as unknown as Account;

function makeVm(
  lmAccounts: LunchmoneyAccount[],
  wfAccounts: Account[],
  draft: AccountMapping = {},
  savedMapping: AccountMapping = {},
  wfCashBalances: Record<string, number> = {},
) {
  return buildAccountViewModel(lmAccounts, wfAccounts, draft, savedMapping, wfCashBalances);
}

const baseAccounts = [lm(1, "Checking", "Big Bank"), lm(2, "Savings")];

describe("AccountLinkTable", () => {
  it("groups accounts by institution", () => {
    render(
      <AccountLinkTable
        vm={makeVm(baseAccounts, [])}
        onDraftChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText("Big Bank")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  it("renders Skip for ignore entry", () => {
    render(
      <AccountLinkTable
        vm={makeVm(baseAccounts, [])}
        onDraftChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    // Each row: 1 in WfAccountInfo column + 1 in dropdown menu = 2 per account × 2 accounts = 4
    expect(screen.getAllByText("Skip").length).toBeGreaterThanOrEqual(2);
  });

  it("renders 'Create new account' for create entry", () => {
    const draft: AccountMapping = { 1: { type: "create" } };
    render(
      <AccountLinkTable
        vm={makeVm(baseAccounts, [], draft)}
        onDraftChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText("Create new account")).toBeInTheDocument();
  });

  it("renders linked account name", () => {
    const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    render(
      <AccountLinkTable
        vm={makeVm(baseAccounts, [wf("w1", "My Portfolio")], draft)}
        onDraftChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText("My Portfolio")).toBeInTheDocument();
  });

  it("renders 'Unknown account' when wf account not found", () => {
    const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "missing" } };
    render(
      <AccountLinkTable
        vm={makeVm(baseAccounts, [], draft)}
        onDraftChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText("Unknown account")).toBeInTheDocument();
  });

  it("opens the linked Wealthfolio account from its own button", async () => {
    const onNavigate = vi.fn();
    const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    render(
      <AccountLinkTable
        vm={makeVm(baseAccounts, [wf("w1", "My Portfolio")], draft)}
        onDraftChange={vi.fn()}
        onNavigate={onNavigate}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Open My Portfolio in Wealthfolio" }));
    expect(onNavigate).toHaveBeenCalledWith("/accounts/w1");
  });

  it("makes the whole target cell the control for choosing a Wealthfolio account", () => {
    render(
      <AccountLinkTable
        vm={makeVm(baseAccounts, [])}
        onDraftChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Choose Wealthfolio account for Checking" });
    expect(trigger).toHaveTextContent("Skip");
  });

  it("labels the status icon so linked and unlinked rows can be told apart", () => {
    const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    render(
      <AccountLinkTable
        vm={makeVm(baseAccounts, [wf("w1", "My Portfolio")], saved, saved)}
        onDraftChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByRole("img", { name: "Linked" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Not linked" })).toBeInTheDocument();
  });

  it("shows whether a Lunch Money account is manual or synced from a bank", () => {
    render(
      <AccountLinkTable
        vm={makeVm(
          [
            { ...lm(1, "Joint Account"), source: "manual" },
            { ...lm(2, "Joint Account"), source: "synced" },
          ],
          [],
        )}
        onDraftChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText(/Manual/)).toBeInTheDocument();
    expect(screen.getByText(/Synced/)).toBeInTheDocument();
  });

  it("shows the original name only when the display name doesn't already contain it", () => {
    render(
      <AccountLinkTable
        vm={makeVm(
          [
            { ...lm(1, "GBP"), display_name: "bunq GBP" },
            { ...lm(2, "1st Account"), display_name: "FD Joint Account" },
          ],
          [],
        )}
        onDraftChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.queryByText("(GBP)")).toBeNull();
    expect(screen.getByText("(1st Account)")).toBeInTheDocument();
  });

  it("shows the Lunch Money balance in the account's currency, even when not linked", () => {
    render(
      <AccountLinkTable
        vm={makeVm([{ ...lm(1, "Checking"), balance: "1234.5000", currency: "gbp" }], [])}
        onDraftChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText(/£1,234\.50/)).toBeInTheDocument();
    expect(screen.queryByText("--,--.--")).toBeNull();
  });

  it("falls back to number and code for a currency the browser can't format", () => {
    render(
      <AccountLinkTable
        vm={makeVm([{ ...lm(1, "Checking"), balance: "42", currency: "not-a-code" }], [])}
        onDraftChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText("42.00 NOT-A-CODE")).toBeInTheDocument();
  });

  it("says when the linked Wealthfolio balance matches", () => {
    const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    render(
      <AccountLinkTable
        vm={makeVm(baseAccounts, [], {}, saved, { w1: 100.0 })}
        onDraftChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText("Matches Wealthfolio")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-alert-triangle")).toBeNull();
  });

  it("shows the Wealthfolio balance and the difference when they don't match", () => {
    const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    render(
      <AccountLinkTable
        vm={makeVm(baseAccounts, [], {}, saved, { w1: 200.0 })}
        onDraftChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByTestId("icon-alert-triangle")).toBeInTheDocument();
    expect(screen.getByText(/Wealthfolio \$200\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\+\$100\.00/)).toBeInTheDocument();
  });

  it("calls onDraftChange with ignore when Skip dropdown item is clicked", async () => {
    const onDraftChange = vi.fn();
    render(
      <AccountLinkTable
        vm={makeVm(baseAccounts, [])}
        onDraftChange={onDraftChange}
        onNavigate={vi.fn()}
      />,
    );
    await userEvent.click(screen.getAllByRole("menuitem", { name: "Skip" })[0]);
    expect(onDraftChange).toHaveBeenCalledWith(1, { type: "ignore" });
  });

  it("calls onDraftChange with create when 'Create new account…' is clicked", async () => {
    const onDraftChange = vi.fn();
    render(
      <AccountLinkTable
        vm={makeVm(baseAccounts, [])}
        onDraftChange={onDraftChange}
        onNavigate={vi.fn()}
      />,
    );
    await userEvent.click(screen.getAllByRole("menuitem", { name: "Create new account…" })[0]);
    expect(onDraftChange).toHaveBeenCalledWith(1, { type: "create" });
  });

  it("doesn't offer Wealthfolio accounts in a different currency", () => {
    render(
      <AccountLinkTable
        vm={makeVm(
          [{ ...lm(1, "Checking"), currency: "gbp" }],
          [
            { ...wf("w1", "Pounds"), currency: "GBP" } as never,
            { ...wf("w2", "Euros"), currency: "EUR" } as never,
          ],
        )}
        onDraftChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByRole("menuitem", { name: "Pounds" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Euros" })).toBeNull();
  });

  it("calls onDraftChange with existing when a wf account item is clicked", async () => {
    const onDraftChange = vi.fn();
    const wfWithTracking = { ...wf("w1", "Portfolio"), trackingMode: "HOLDINGS" } as never;
    render(
      <AccountLinkTable
        vm={makeVm(baseAccounts, [wfWithTracking])}
        onDraftChange={onDraftChange}
        onNavigate={vi.fn()}
      />,
    );
    await userEvent.click(screen.getAllByRole("menuitem", { name: "Portfolio" })[0]);
    expect(onDraftChange).toHaveBeenCalledWith(1, { type: "existing", wfAccountId: "w1" });
  });
});
