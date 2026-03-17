import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountLinkTable } from "../AccountLinkTable";
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

const baseProps = {
  lmAccounts: [lm(1, "Checking", "Big Bank"), lm(2, "Savings")],
  wfAccounts: [] as Account[],
  draft: {} as AccountMapping,
  savedMapping: {} as AccountMapping,
  wfCashBalances: {} as Record<string, number>,
  onDraftChange: vi.fn(),
  onNavigate: vi.fn(),
};

describe("AccountLinkTable", () => {
  it("groups accounts by institution", () => {
    render(<AccountLinkTable {...baseProps} />);
    expect(screen.getByText("Big Bank")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  it("renders Skip for ignore entry", () => {
    render(<AccountLinkTable {...baseProps} />);
    // Each row: 1 in WfAccountInfo column + 1 in dropdown menu = 2 per account × 2 accounts = 4
    expect(screen.getAllByText("Skip").length).toBeGreaterThanOrEqual(2);
  });

  it("renders 'Create new account' for create entry", () => {
    const draft: AccountMapping = { 1: { type: "create" } };
    render(<AccountLinkTable {...baseProps} draft={draft} />);
    expect(screen.getByText("Create new account")).toBeInTheDocument();
  });

  it("renders linked account name", () => {
    const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    render(
      <AccountLinkTable {...baseProps} draft={draft} wfAccounts={[wf("w1", "My Portfolio")]} />,
    );
    expect(screen.getByText("My Portfolio")).toBeInTheDocument();
  });

  it("renders 'Unknown account' when wf account not found", () => {
    const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "missing" } };
    render(<AccountLinkTable {...baseProps} draft={draft} />);
    expect(screen.getByText("Unknown account")).toBeInTheDocument();
  });

  it("calls onNavigate when account name link is clicked", async () => {
    const onNavigate = vi.fn();
    const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    render(
      <AccountLinkTable
        {...baseProps}
        draft={draft}
        wfAccounts={[wf("w1", "My Portfolio")]}
        onNavigate={onNavigate}
      />,
    );
    await userEvent.click(screen.getByText("My Portfolio"));
    expect(onNavigate).toHaveBeenCalledWith("/accounts/w1");
  });

  it("renders balance placeholder when wfBalance is null", () => {
    render(<AccountLinkTable {...baseProps} />);
    expect(screen.getAllByText("--,--.--").length).toBeGreaterThan(0);
  });

  it("renders matching balance in green class", () => {
    const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    render(<AccountLinkTable {...baseProps} savedMapping={saved} wfCashBalances={{ w1: 100.0 }} />);
    // lm balance is "100.00", wf balance is 100.00 — should match
    expect(screen.queryByTestId("icon-alert-triangle")).toBeNull();
  });

  it("renders alert icon for mismatched balance", () => {
    const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    render(<AccountLinkTable {...baseProps} savedMapping={saved} wfCashBalances={{ w1: 200.0 }} />);
    expect(screen.getByTestId("icon-alert-triangle")).toBeInTheDocument();
  });

  it("calls onDraftChange with ignore when Skip dropdown item is clicked", async () => {
    const onDraftChange = vi.fn();
    render(<AccountLinkTable {...baseProps} onDraftChange={onDraftChange} />);
    await userEvent.click(screen.getAllByRole("menuitem", { name: "Skip" })[0]);
    expect(onDraftChange).toHaveBeenCalledWith(1, { type: "ignore" });
  });

  it("calls onDraftChange with create when 'Create new account…' is clicked", async () => {
    const onDraftChange = vi.fn();
    render(<AccountLinkTable {...baseProps} onDraftChange={onDraftChange} />);
    await userEvent.click(screen.getAllByRole("menuitem", { name: "Create new account…" })[0]);
    expect(onDraftChange).toHaveBeenCalledWith(1, { type: "create" });
  });

  it("calls onDraftChange with existing when a wf account item is clicked", async () => {
    const onDraftChange = vi.fn();
    const wfWithTracking = { ...wf("w1", "Portfolio"), trackingMode: "HOLDINGS" } as never;
    render(
      <AccountLinkTable
        {...baseProps}
        wfAccounts={[wfWithTracking]}
        onDraftChange={onDraftChange}
      />,
    );
    await userEvent.click(screen.getAllByRole("menuitem", { name: "Portfolio" })[0]);
    expect(onDraftChange).toHaveBeenCalledWith(1, { type: "existing", wfAccountId: "w1" });
  });
});
