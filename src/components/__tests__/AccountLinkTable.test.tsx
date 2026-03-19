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

  it("calls onNavigate when account name link is clicked", async () => {
    const onNavigate = vi.fn();
    const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    render(
      <AccountLinkTable
        vm={makeVm(baseAccounts, [wf("w1", "My Portfolio")], draft)}
        onDraftChange={vi.fn()}
        onNavigate={onNavigate}
      />,
    );
    await userEvent.click(screen.getByText("My Portfolio"));
    expect(onNavigate).toHaveBeenCalledWith("/accounts/w1");
  });

  it("renders balance placeholder when wfBalance is null", () => {
    render(
      <AccountLinkTable
        vm={makeVm(baseAccounts, [])}
        onDraftChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getAllByText("--,--.--").length).toBeGreaterThan(0);
  });

  it("renders matching balance in green class", () => {
    const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    render(
      <AccountLinkTable
        vm={makeVm(baseAccounts, [], {}, saved, { w1: 100.0 })}
        onDraftChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    // lm balance is "100.00", wf balance is 100.00 — should match
    expect(screen.queryByTestId("icon-alert-triangle")).toBeNull();
  });

  it("renders alert icon for mismatched balance", () => {
    const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    render(
      <AccountLinkTable
        vm={makeVm(baseAccounts, [], {}, saved, { w1: 200.0 })}
        onDraftChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByTestId("icon-alert-triangle")).toBeInTheDocument();
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
