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

function makeActions(overrides: Partial<AccountSyncController["actions"]> = {}) {
  return {
    changeDraft: vi.fn(),
    undo: vi.fn(),
    confirm: vi.fn().mockResolvedValue(undefined),
    sync: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeController(overrides: Partial<AccountSyncController> = {}): AccountSyncController {
  return {
    status: { phase: "checking" },
    error: null,
    lastSynced: null,
    lastSyncResult: null,
    busy: { saving: false, syncing: false },
    actions: makeActions(),
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

/** With nothing linked the page leads with the wizard; this reveals the table instead. */
const showTable = () => userEvent.click(screen.getByRole("button", { name: "Show all accounts" }));

beforeEach(() => {
  vi.mocked(useAccountSync).mockReturnValue(makeController());
});

describe("MainPage", () => {
  it("shows loading state", () => {
    vi.mocked(useAccountSync).mockReturnValue(makeController());
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("asks for a Lunch Money token before anything else", () => {
    vi.mocked(useAccountSync).mockReturnValue(makeController({ status: { phase: "no-api-key" } }));
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.getByTestId("empty")).toBeInTheDocument();
    expect(screen.getByText("Connect Lunch Money")).toBeInTheDocument();
  });

  it("says when Lunch Money has no accounts", () => {
    vi.mocked(useAccountSync).mockReturnValue(makeController({ status: { phase: "empty" } }));
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.getByTestId("empty")).toBeInTheDocument();
    expect(screen.getByText("No Lunch Money accounts")).toBeInTheDocument();
  });

  it("renders search and filter controls when accounts are present", async () => {
    vi.mocked(useAccountSync).mockReturnValue(readyController([lm(1)], [wf("w1")]));
    render(<MainPage ctx={createMockCtx()} />);
    await showTable();
    expect(screen.getByPlaceholderText("Search accounts...")).toBeInTheDocument();
    expect(screen.getByText("all")).toBeInTheDocument();
    expect(screen.getByText("linked")).toBeInTheDocument();
    expect(screen.getByText("skipped")).toBeInTheDocument();
  });

  it("shows Undo and Save buttons when draft differs from savedMapping", async () => {
    vi.mocked(useAccountSync).mockReturnValue(
      readyController([lm(1)], [wf("w1")], { 1: { type: "create" } }, {}),
    );
    render(<MainPage ctx={createMockCtx()} />);
    await showTable();
    expect(screen.getByText("Undo")).toBeInTheDocument();
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
  });

  it("hides Undo/Save when isDirty=false", () => {
    vi.mocked(useAccountSync).mockReturnValue(readyController([lm(1)], [wf("w1")]));
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.queryByText("Undo")).toBeNull();
  });

  describe("sync", () => {
    const saved = { 1: { type: "existing" as const, wfAccountId: "w1" } };

    it("has a single Sync button that refreshes and imports in one go", async () => {
      const actions = makeActions();
      vi.mocked(useAccountSync).mockReturnValue(
        readyController([lm(1)], [wf("w1")], saved, saved, { actions }),
      );
      render(<MainPage ctx={createMockCtx()} />);
      expect(screen.queryByText("Import Balances")).toBeNull();
      expect(screen.queryByTitle("Refresh Lunch Money accounts")).toBeNull();
      await userEvent.click(screen.getByRole("button", { name: "Sync" }));
      expect(actions.sync).toHaveBeenCalledTimes(1);
    });

    it("disables Sync while it runs", () => {
      vi.mocked(useAccountSync).mockReturnValue(
        readyController([lm(1)], [wf("w1")], saved, saved, {
          busy: { saving: false, syncing: true },
        }),
      );
      render(<MainPage ctx={createMockCtx()} />);
      expect(screen.getByRole("button", { name: /Syncing/ })).toBeDisabled();
    });

    it("says when it last synced and what the last sync changed", () => {
      vi.mocked(useAccountSync).mockReturnValue(
        readyController([lm(1)], [wf("w1")], saved, saved, {
          lastSynced: new Date(),
          lastSyncResult: { imported: 2 },
        }),
      );
      render(<MainPage ctx={createMockCtx()} />);
      expect(screen.getByText("Synced 2 minutes ago · 2 balances updated")).toBeInTheDocument();
    });

    it("says when the last sync found nothing to update", () => {
      vi.mocked(useAccountSync).mockReturnValue(
        readyController([lm(1)], [wf("w1")], saved, saved, {
          lastSynced: new Date(),
          lastSyncResult: { imported: 0 },
        }),
      );
      render(<MainPage ctx={createMockCtx()} />);
      expect(
        screen.getByText("Synced 2 minutes ago · all balances up to date"),
      ).toBeInTheDocument();
    });

    it("shows only the time for a sync from an earlier session", () => {
      vi.mocked(useAccountSync).mockReturnValue(
        readyController([lm(1)], [wf("w1")], saved, saved, { lastSynced: new Date() }),
      );
      render(<MainPage ctx={createMockCtx()} />);
      expect(screen.getByText("Synced 2 minutes ago")).toBeInTheDocument();
    });
  });

  describe("link wizard", () => {
    it("leads first-time users into the wizard instead of the table", async () => {
      vi.mocked(useAccountSync).mockReturnValue(readyController([lm(1), lm(2)], [wf("w1")]));
      render(<MainPage ctx={createMockCtx()} />);
      expect(screen.getByTestId("empty")).toHaveTextContent("Link your accounts");
      expect(screen.getByText(/Found 2 Lunch Money accounts/)).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Search accounts...")).toBeNull();
      await userEvent.click(screen.getByRole("button", { name: "Start linking" }));
      expect(screen.getByText("Account 1 of 2")).toBeInTheDocument();
    });

    it("can show the table instead of the wizard", async () => {
      vi.mocked(useAccountSync).mockReturnValue(readyController([lm(1)], [wf("w1")]));
      render(<MainPage ctx={createMockCtx()} />);
      await showTable();
      expect(screen.queryByText("Link your accounts")).toBeNull();
      expect(screen.getByPlaceholderText("Search accounts...")).toBeInTheDocument();
    });

    it("doesn't show the invitation once accounts are linked", () => {
      const saved = { 1: { type: "existing" as const, wfAccountId: "w1" } };
      vi.mocked(useAccountSync).mockReturnValue(readyController([lm(1)], [wf("w1")], saved, saved));
      render(<MainPage ctx={createMockCtx()} />);
      expect(screen.queryByText("Link your accounts")).toBeNull();
    });

    it("can be reopened from the header, replacing the table", async () => {
      const saved = { 1: { type: "existing" as const, wfAccountId: "w1" } };
      vi.mocked(useAccountSync).mockReturnValue(readyController([lm(1)], [wf("w1")], saved, saved));
      render(<MainPage ctx={createMockCtx()} />);
      await userEvent.click(screen.getByRole("button", { name: "Link accounts" }));
      expect(screen.getByText("Account 1 of 1")).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Search accounts...")).toBeNull();
    });

    it("discards wizard choices on cancel", async () => {
      const actions = makeActions();
      vi.mocked(useAccountSync).mockReturnValue(
        readyController([lm(1)], [wf("w1")], {}, {}, { actions }),
      );
      render(<MainPage ctx={createMockCtx()} />);
      await userEvent.click(screen.getByRole("button", { name: "Start linking" }));
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(actions.undo).toHaveBeenCalled();
      expect(screen.queryByText(/Account 1 of 1/)).toBeNull();
    });

    it("applies the wizard's changes and returns to the table", async () => {
      const actions = makeActions();
      const draft = { 1: { type: "existing" as const, wfAccountId: "w1" } };
      vi.mocked(useAccountSync).mockReturnValue(
        readyController([lm(1)], [wf("w1")], draft, {}, { actions }),
      );
      render(<MainPage ctx={createMockCtx()} />);
      await userEvent.click(screen.getByRole("button", { name: "Link accounts" }));
      await userEvent.click(screen.getByRole("button", { name: "Review changes" }));
      await userEvent.click(screen.getByRole("button", { name: "Apply changes" }));
      expect(actions.confirm).toHaveBeenCalledWith({ importBalances: true });
      expect(screen.queryByRole("button", { name: "Apply changes" })).toBeNull();
    });

    it("passes choices made in the wizard to the draft", async () => {
      const actions = makeActions();
      vi.mocked(useAccountSync).mockReturnValue(
        readyController([lm(1)], [wf("w1")], {}, {}, { actions }),
      );
      render(<MainPage ctx={createMockCtx()} />);
      await userEvent.click(screen.getByRole("button", { name: "Start linking" }));
      await userEvent.click(screen.getByRole("radio", { name: /WF w1/ }));
      expect(actions.changeDraft).toHaveBeenCalledWith(1, { type: "existing", wfAccountId: "w1" });
    });
  });

  it("opens ConfirmSaveDialog on Save click", async () => {
    vi.mocked(useAccountSync).mockReturnValue(
      readyController([lm(1)], [wf("w1")], { 1: { type: "create" } }, {}),
    );
    render(<MainPage ctx={createMockCtx()} />);
    await showTable();
    await userEvent.click(screen.getByText("Save Changes"));
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
  });

  it("shows linked accounts first once there are some", () => {
    const saved = { 1: { type: "existing" as const, wfAccountId: "w1" } };
    vi.mocked(useAccountSync).mockReturnValue(
      readyController([lm(1), lm(2)], [wf("w1")], saved, saved),
    );
    render(<MainPage ctx={createMockCtx()} />);
    expect(screen.getByText("linked")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Account 2")).toBeNull();
  });

  it("switches to linked tab on filter click", async () => {
    vi.mocked(useAccountSync).mockReturnValue(readyController([lm(1)], [wf("w1")]));
    render(<MainPage ctx={createMockCtx()} />);
    await showTable();
    expect(screen.getByText("all")).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByText("linked"));
    expect(screen.getByText("linked")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("all")).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the active filter tab selected when it is clicked again", async () => {
    vi.mocked(useAccountSync).mockReturnValue(readyController([lm(1)], [wf("w1")]));
    render(<MainPage ctx={createMockCtx()} />);
    await showTable();
    await userEvent.click(screen.getByText("all"));
    expect(screen.getByText("all")).toHaveAttribute("aria-pressed", "true");
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
          actions: makeActions({ confirm }),
        },
      ),
    );
    render(<MainPage ctx={createMockCtx()} />);
    await showTable();
    await userEvent.click(screen.getByText("Save Changes"));
    await userEvent.click(screen.getByText("Confirm"));
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("closes dialog on Cancel", async () => {
    vi.mocked(useAccountSync).mockReturnValue(
      readyController([lm(1)], [wf("w1")], { 1: { type: "create" } }, {}),
    );
    render(<MainPage ctx={createMockCtx()} />);
    await showTable();
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
    await showTable();
    const input = screen.getByPlaceholderText("Search accounts...");
    await userEvent.type(input, "zzz_no_match");
    expect(screen.getByText("No accounts match your search.")).toBeInTheDocument();
  });

  it("clears search when clear button is clicked", async () => {
    vi.mocked(useAccountSync).mockReturnValue(readyController([lm(1)], [wf("w1")]));
    render(<MainPage ctx={createMockCtx()} />);
    await showTable();
    const input = screen.getByPlaceholderText("Search accounts...");
    await userEvent.type(input, "zzz");
    await userEvent.click(screen.getByLabelText("Clear search"));
    expect(input).toHaveValue("");
  });

  it("navigates to settings when Settings button is clicked", async () => {
    vi.mocked(useAccountSync).mockReturnValue(makeController());
    const ctx = createMockCtx();
    render(<MainPage ctx={ctx} />);
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(ctx.api.navigation.navigate).toHaveBeenCalledWith("/addons/lunchmoney-addon/settings");
  });

  it("goes to settings to add a token", async () => {
    vi.mocked(useAccountSync).mockReturnValue(makeController({ status: { phase: "no-api-key" } }));
    const ctx = createMockCtx();
    render(<MainPage ctx={ctx} />);
    await userEvent.click(screen.getByRole("button", { name: "Add access token" }));
    expect(ctx.api.navigation.navigate).toHaveBeenCalledWith("/addons/lunchmoney-addon/settings");
  });

  it("calls navigate when AccountLinkTable onNavigate is triggered", async () => {
    const draft = { 1: { type: "existing" as const, wfAccountId: "w1" } };
    vi.mocked(useAccountSync).mockReturnValue(readyController([lm(1)], [wf("w1")], draft, draft));
    const ctx = createMockCtx();
    render(<MainPage ctx={ctx} />);
    await userEvent.click(screen.getByRole("button", { name: "Open WF w1 in Wealthfolio" }));
    expect(ctx.api.navigation.navigate).toHaveBeenCalledWith("/accounts/w1");
  });
});
