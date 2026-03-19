import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmSaveDialog } from "../ConfirmSaveDialog";
import { buildAccountViewModel } from "../../lib/accountViewModel";
import type { LunchmoneyAccount } from "../../lib/lunchmoney";
import type { Account } from "@wealthfolio/addon-sdk";
import type { AccountMapping } from "../../types";

const lm = (id: number, name = `LM ${id}`): LunchmoneyAccount => ({
  id,
  name,
  display_name: null,
  type: "cash",
  subtype: null,
  currency: "usd",
  balance: "100.00",
  status: "active",
});

const wf = (id: string, name = `WF ${id}`): Account =>
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
) {
  return buildAccountViewModel(lmAccounts, wfAccounts, draft, savedMapping, {});
}

describe("ConfirmSaveDialog", () => {
  it("renders nothing when open=false", () => {
    render(
      <ConfirmSaveDialog open={false} vm={makeVm([], [])} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.queryByTestId("dialog")).toBeNull();
  });

  it("shows 'No changes' when there are no entries", () => {
    render(
      <ConfirmSaveDialog open={true} vm={makeVm([], [])} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText("No changes to apply.")).toBeInTheDocument();
  });

  it("shows toCreate section", () => {
    const draft: AccountMapping = { 1: { type: "create" } };
    render(
      <ConfirmSaveDialog
        open={true}
        vm={makeVm([lm(1, "Checking")], [], draft)}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Accounts to create:")).toBeInTheDocument();
    expect(screen.getByText("Checking")).toBeInTheDocument();
  });

  it("shows institution group for create entry", () => {
    const acc = { ...lm(1, "Checking"), institution_name: "Big Bank" };
    const draft: AccountMapping = { 1: { type: "create" } };
    render(
      <ConfirmSaveDialog
        open={true}
        vm={makeVm([acc], [], draft)}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/group: Big Bank/)).toBeInTheDocument();
  });

  it("shows wasLinkedTo for create entry that was previously linked", () => {
    const draft: AccountMapping = { 1: { type: "create" } };
    const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    render(
      <ConfirmSaveDialog
        open={true}
        vm={makeVm([lm(1)], [wf("w1", "Old Account")], draft, saved)}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/unlinks from Old Account/)).toBeInTheDocument();
  });

  it("shows toLink section", () => {
    const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    render(
      <ConfirmSaveDialog
        open={true}
        vm={makeVm([lm(1, "Checking")], [wf("w1", "My WF")], draft)}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Accounts to link:")).toBeInTheDocument();
    expect(screen.getByText(/Checking.*My WF/s)).toBeInTheDocument();
  });

  it("shows toRelink section", () => {
    const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "w2" } };
    const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    render(
      <ConfirmSaveDialog
        open={true}
        vm={makeVm([lm(1, "Checking")], [wf("w1", "Old WF"), wf("w2", "New WF")], draft, saved)}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Accounts to relink:")).toBeInTheDocument();
    expect(screen.getByText(/Old WF.*New WF/s)).toBeInTheDocument();
  });

  it("shows toUnlink section", () => {
    const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    render(
      <ConfirmSaveDialog
        open={true}
        vm={makeVm([lm(1, "Checking")], [wf("w1", "My WF")], {}, saved)}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Accounts to unlink:")).toBeInTheDocument();
  });

  it("shows unchanged section with display_name", () => {
    const entry = { type: "existing" as const, wfAccountId: "w1" };
    const lmWithDisplay = { ...lm(1), display_name: "Pretty Name" };
    render(
      <ConfirmSaveDialog
        open={true}
        vm={makeVm([lmWithDisplay], [wf("w1", "My WF")], { 1: entry }, { 1: entry })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Unchanged:")).toBeInTheDocument();
    expect(screen.getByText(/Pretty Name/)).toBeInTheDocument();
  });

  it("Confirm button is disabled when no changes", () => {
    render(
      <ConfirmSaveDialog open={true} vm={makeVm([], [])} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText("Confirm")).toBeDisabled();
  });

  it("calls onConfirm when confirm is clicked", async () => {
    const onConfirm = vi.fn();
    const draft: AccountMapping = { 1: { type: "create" } };
    render(
      <ConfirmSaveDialog
        open={true}
        vm={makeVm([lm(1)], [], draft)}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel is clicked", async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmSaveDialog open={true} vm={makeVm([], [])} onConfirm={vi.fn()} onCancel={onCancel} />,
    );
    await userEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
