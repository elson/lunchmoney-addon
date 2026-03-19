import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MainPage } from "../MainPage";
import { createMockCtx } from "../../test/mockCtx";
import type { AccountSyncController } from "../../hooks/useAccountSync";
import { buildAccountViewModel } from "../../lib/accountViewModel";
import type { LunchmoneyAccount } from "../../lib/lunchmoney";
import type { Account } from "@wealthfolio/addon-sdk";

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

function makeController(overrides: Partial<AccountSyncController> = {}): AccountSyncController {
  return {
    status: { phase: "checking" },
    error: null,
    lastSynced: null,
    busy: { saving: false, syncing: false, refreshing: false },
    actions: {
      refresh: vi.fn(),
      changeDraft: vi.fn(),
      undo: vi.fn(),
      confirm: vi.fn().mockResolvedValue(undefined),
      syncBalances: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };
}

function readyController(
  lmAccounts: LunchmoneyAccount[],
  wfAccounts: Account[],
  draft = {} as Record<number, import("../../types").MappingEntry>,
  savedMapping = {} as Record<number, import("../../types").MappingEntry>,
  overrides: Partial<AccountSyncController> = {},
): AccountSyncController {
  const vm = buildAccountViewModel(lmAccounts, wfAccounts, draft, savedMapping, {});
  return makeController({
    status: { phase: "ready", vm },
    ...overrides,
  });
}

beforeEach(() => {
  vi.mocked(useAccountSync).mockReturnValue(makeController());
});

describe("MainPage", () => {
  it("shows loading state", () => {
    vi.mocked(useAccountSync).mockReturnValue(makeController());
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows no API key placeholder", () => {
    vi.mocked(useAccountSync).mockReturnValue(makeController({ status: { phase: "no-api-key" } }));
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.getByTestId("empty-placeholder")).toBeInTheDocument();
    expect(screen.getByText("No API key set")).toBeInTheDocument();
  });

  it("shows 'No accounts found' when status is empty", () => {
    vi.mocked(useAccountSync).mockReturnValue(makeController({ status: { phase: "empty" } }));
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.getByText("No accounts found.")).toBeInTheDocument();
  });

  it("renders search and filter controls when accounts are present", () => {
    vi.mocked(useAccountSync).mockReturnValue(readyController([lm(1)], [wf("w1")]));
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.getByPlaceholderText("Search accounts...")).toBeInTheDocument();
    expect(screen.getByText("all")).toBeInTheDocument();
    expect(screen.getByText("linked")).toBeInTheDocument();
    expect(screen.getByText("skipped")).toBeInTheDocument();
  });

  it("shows Undo and Save buttons when draft differs from savedMapping", () => {
    vi.mocked(useAccountSync).mockReturnValue(
      readyController([lm(1)], [wf("w1")], { 1: { type: "create" } }, {}),
    );
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.getByText("Undo")).toBeInTheDocument();
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
  });

  it("hides Undo/Save when isDirty=false", () => {
    vi.mocked(useAccountSync).mockReturnValue(readyController([lm(1)], [wf("w1")]));
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.queryByText("Undo")).toBeNull();
  });

  it("shows Import Balances button when linkedCount > 0", () => {
    const saved = { 1: { type: "existing" as const, wfAccountId: "w1" } };
    vi.mocked(useAccountSync).mockReturnValue(readyController([lm(1)], [wf("w1")], saved, saved));
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.getByText("Import Balances")).toBeInTheDocument();
  });

  it("hides Import Balances button when no linked accounts", () => {
    vi.mocked(useAccountSync).mockReturnValue(readyController([lm(1)], [wf("w1")]));
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.queryByText("Import Balances")).toBeNull();
  });

  it("opens ConfirmSaveDialog on Save click", async () => {
    vi.mocked(useAccountSync).mockReturnValue(
      readyController([lm(1)], [wf("w1")], { 1: { type: "create" } }, {}),
    );
    render(<MainPage ctx={createMockCtx()} />);
    await userEvent.click(screen.getByText("Save Changes"));
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
  });

  it("switches to linked tab on filter click", async () => {
    vi.mocked(useAccountSync).mockReturnValue(readyController([lm(1)], [wf("w1")]));
    render(<MainPage ctx={createMockCtx()} />);
    await userEvent.click(screen.getByText("linked"));
    expect(screen.getByText("linked")).toBeInTheDocument();
  });

  it("calls confirm via dialog onConfirm", async () => {
    const confirm = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAccountSync).mockReturnValue(
      readyController(
        [lm(1)],
        [wf("w1")],
        { 1: { type: "create" } },
        {},
        {
          actions: {
            refresh: vi.fn(),
            changeDraft: vi.fn(),
            undo: vi.fn(),
            confirm,
            syncBalances: vi.fn().mockResolvedValue(undefined),
          },
        },
      ),
    );
    render(<MainPage ctx={createMockCtx()} />);
    await userEvent.click(screen.getByText("Save Changes"));
    await userEvent.click(screen.getByText("Confirm"));
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("closes dialog on Cancel", async () => {
    vi.mocked(useAccountSync).mockReturnValue(
      readyController([lm(1)], [wf("w1")], { 1: { type: "create" } }, {}),
    );
    render(<MainPage ctx={createMockCtx()} />);
    await userEvent.click(screen.getByText("Save Changes"));
    await userEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByTestId("dialog")).toBeNull();
  });

  it("shows error message when error is set", () => {
    vi.mocked(useAccountSync).mockReturnValue(makeController({ error: "Something went wrong" }));
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows 'No accounts match your search' for empty filtered list", async () => {
    vi.mocked(useAccountSync).mockReturnValue(readyController([lm(1)], [wf("w1")]));
    render(<MainPage ctx={createMockCtx()} />);
    const input = screen.getByPlaceholderText("Search accounts...");
    await userEvent.type(input, "zzz_no_match");
    expect(screen.getByText("No accounts match your search.")).toBeInTheDocument();
  });

  it("clears search when clear button is clicked", async () => {
    vi.mocked(useAccountSync).mockReturnValue(readyController([lm(1)], [wf("w1")]));
    render(<MainPage ctx={createMockCtx()} />);
    const input = screen.getByPlaceholderText("Search accounts...");
    await userEvent.type(input, "zzz");
    await userEvent.click(screen.getByLabelText("Clear search"));
    expect(input).toHaveValue("");
  });

  it("navigates to settings when Settings button is clicked", async () => {
    vi.mocked(useAccountSync).mockReturnValue(makeController());
    const ctx = createMockCtx();
    render(<MainPage ctx={ctx} />);
    await userEvent.click(screen.getByTitle("Settings"));
    expect(ctx.api.navigation.navigate).toHaveBeenCalledWith("/addon/lunch-money/settings");
  });

  it("navigates to settings from 'Get started' button when no API key", async () => {
    vi.mocked(useAccountSync).mockReturnValue(makeController({ status: { phase: "no-api-key" } }));
    const ctx = createMockCtx();
    render(<MainPage ctx={ctx} />);
    await userEvent.click(screen.getByText("Get started"));
    expect(ctx.api.navigation.navigate).toHaveBeenCalledWith("/addon/lunch-money/settings");
  });

  it("calls navigate when AccountLinkTable onNavigate is triggered", async () => {
    const draft = { 1: { type: "existing" as const, wfAccountId: "w1" } };
    vi.mocked(useAccountSync).mockReturnValue(readyController([lm(1)], [wf("w1")], draft, draft));
    const ctx = createMockCtx();
    render(<MainPage ctx={ctx} />);
    await userEvent.click(screen.getByText("WF w1"));
    expect(ctx.api.navigation.navigate).toHaveBeenCalledWith("/accounts/w1");
  });
});
