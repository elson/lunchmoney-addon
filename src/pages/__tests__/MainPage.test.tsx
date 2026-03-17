import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MainPage } from "../MainPage";
import { createMockCtx } from "../../test/mockCtx";
import type { LunchmoneyAccount } from "../../lib/lunchmoney";
import type { Account } from "@wealthfolio/addon-sdk";
import type { AccountMapping } from "../../types";

vi.mock("../../hooks/useAccountSync");
vi.mock("date-fns", () => ({
  formatDistanceToNow: vi.fn(() => "2 minutes ago"),
}));

import { useAccountSync } from "../../hooks/useAccountSync";

const lm = (id: number): LunchmoneyAccount => ({
  id,
  name: `Account ${id}`,
  display_name: null,
  type: "cash",
  subtype: null,
  currency: "usd",
  balance: "100.00",
  status: "active",
});

const wf = (id: string): Account =>
  ({
    id,
    name: `WF ${id}`,
    accountType: "CASH",
    currency: "USD",
    isDefault: false,
    isActive: true,
    trackingMode: "HOLDINGS",
  }) as unknown as Account;

const defaultHookState = {
  lmAccounts: null as LunchmoneyAccount[] | null,
  wfAccounts: null as Account[] | null,
  savedMapping: {} as AccountMapping,
  draft: {} as AccountMapping,
  loading: false,
  error: null as string | null,
  hasApiKey: null as boolean | null,
  isSaving: false,
  isDirty: false,
  lastSynced: null as Date | null,
  isSyncingBalances: false,
  wfCashBalances: {} as Record<string, number>,
  handleRefresh: vi.fn(),
  handleDraftChange: vi.fn(),
  handleUndo: vi.fn(),
  handleConfirm: vi.fn().mockResolvedValue(undefined),
  handleSyncBalances: vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
  vi.mocked(useAccountSync).mockReturnValue({ ...defaultHookState });
});

describe("MainPage", () => {
  it("shows loading state", () => {
    vi.mocked(useAccountSync).mockReturnValue({
      ...defaultHookState,
      hasApiKey: null,
      loading: true,
    });
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows no API key placeholder", () => {
    vi.mocked(useAccountSync).mockReturnValue({
      ...defaultHookState,
      hasApiKey: false,
    });
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.getByTestId("empty-placeholder")).toBeInTheDocument();
    expect(screen.getByText("No API key set")).toBeInTheDocument();
  });

  it("shows 'No accounts found' when lmAccounts is empty", () => {
    vi.mocked(useAccountSync).mockReturnValue({
      ...defaultHookState,
      hasApiKey: true,
      lmAccounts: [],
      wfAccounts: [],
    });
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.getByText("No accounts found.")).toBeInTheDocument();
  });

  it("renders search and filter controls when accounts are present", () => {
    vi.mocked(useAccountSync).mockReturnValue({
      ...defaultHookState,
      hasApiKey: true,
      lmAccounts: [lm(1)],
      wfAccounts: [wf("w1")],
    });
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.getByPlaceholderText("Search accounts...")).toBeInTheDocument();
    expect(screen.getByText("all")).toBeInTheDocument();
    expect(screen.getByText("linked")).toBeInTheDocument();
    expect(screen.getByText("skipped")).toBeInTheDocument();
  });

  it("shows Undo and Save buttons when isDirty=true", () => {
    vi.mocked(useAccountSync).mockReturnValue({
      ...defaultHookState,
      hasApiKey: true,
      lmAccounts: [lm(1)],
      wfAccounts: [wf("w1")],
      isDirty: true,
    });
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.getByText("Undo")).toBeInTheDocument();
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
  });

  it("hides Undo/Save when isDirty=false", () => {
    vi.mocked(useAccountSync).mockReturnValue({
      ...defaultHookState,
      hasApiKey: true,
      lmAccounts: [lm(1)],
      wfAccounts: [wf("w1")],
    });
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.queryByText("Undo")).toBeNull();
  });

  it("shows Import Balances button when linkedCount > 0", () => {
    vi.mocked(useAccountSync).mockReturnValue({
      ...defaultHookState,
      hasApiKey: true,
      lmAccounts: [lm(1)],
      wfAccounts: [wf("w1")],
      savedMapping: { 1: { type: "existing", wfAccountId: "w1" } },
    });
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.getByText("Import Balances")).toBeInTheDocument();
  });

  it("hides Import Balances button when no linked accounts", () => {
    vi.mocked(useAccountSync).mockReturnValue({
      ...defaultHookState,
      hasApiKey: true,
      lmAccounts: [lm(1)],
      wfAccounts: [wf("w1")],
    });
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.queryByText("Import Balances")).toBeNull();
  });

  it("opens ConfirmSaveDialog on Save click", async () => {
    vi.mocked(useAccountSync).mockReturnValue({
      ...defaultHookState,
      hasApiKey: true,
      lmAccounts: [lm(1)],
      wfAccounts: [wf("w1")],
      isDirty: true,
    });
    render(<MainPage ctx={createMockCtx()} />);
    await userEvent.click(screen.getByText("Save Changes"));
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
  });

  it("switches to linked tab on filter click", async () => {
    vi.mocked(useAccountSync).mockReturnValue({
      ...defaultHookState,
      hasApiKey: true,
      lmAccounts: [lm(1)],
      wfAccounts: [wf("w1")],
    });
    render(<MainPage ctx={createMockCtx()} />);
    await userEvent.click(screen.getByText("linked"));
    // The linked tab button should now be active (no error thrown)
    expect(screen.getByText("linked")).toBeInTheDocument();
  });

  it("calls handleConfirm via dialog onConfirm", async () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAccountSync).mockReturnValue({
      ...defaultHookState,
      hasApiKey: true,
      lmAccounts: [lm(1)],
      wfAccounts: [wf("w1")],
      isDirty: true,
      // draft has a create entry so Confirm button is enabled
      draft: { 1: { type: "create" } },
      handleConfirm,
    });
    render(<MainPage ctx={createMockCtx()} />);
    await userEvent.click(screen.getByText("Save Changes"));
    // Dialog is open — click Confirm (enabled because hasChanges=true)
    await userEvent.click(screen.getByText("Confirm"));
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it("closes dialog on Cancel", async () => {
    vi.mocked(useAccountSync).mockReturnValue({
      ...defaultHookState,
      hasApiKey: true,
      lmAccounts: [lm(1)],
      wfAccounts: [wf("w1")],
      isDirty: true,
    });
    render(<MainPage ctx={createMockCtx()} />);
    await userEvent.click(screen.getByText("Save Changes"));
    await userEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByTestId("dialog")).toBeNull();
  });

  it("shows error message when error is set", () => {
    vi.mocked(useAccountSync).mockReturnValue({
      ...defaultHookState,
      error: "Something went wrong",
    });
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows 'No accounts match your search' for empty filtered list", async () => {
    vi.mocked(useAccountSync).mockReturnValue({
      ...defaultHookState,
      hasApiKey: true,
      lmAccounts: [lm(1)],
      wfAccounts: [wf("w1")],
    });
    render(<MainPage ctx={createMockCtx()} />);
    const input = screen.getByPlaceholderText("Search accounts...");
    await userEvent.type(input, "zzz_no_match");
    expect(screen.getByText("No accounts match your search.")).toBeInTheDocument();
  });

  it("clears search when clear button is clicked", async () => {
    vi.mocked(useAccountSync).mockReturnValue({
      ...defaultHookState,
      hasApiKey: true,
      lmAccounts: [lm(1)],
      wfAccounts: [wf("w1")],
    });
    render(<MainPage ctx={createMockCtx()} />);
    const input = screen.getByPlaceholderText("Search accounts...");
    await userEvent.type(input, "zzz");
    await userEvent.click(screen.getByLabelText("Clear search"));
    expect(input).toHaveValue("");
  });
});
