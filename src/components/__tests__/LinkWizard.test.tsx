import React, { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Account } from "@wealthfolio/addon-sdk";
import { LinkWizard } from "../LinkWizard";
import { buildAccountViewModel } from "../../lib/accountViewModel";
import type { LunchmoneyAccount } from "../../lib/lunchmoney";
import type { AccountMapping } from "../../types";

const lm = (id: number, overrides: Partial<LunchmoneyAccount> = {}): LunchmoneyAccount => ({
  id,
  name: `Account ${id}`,
  display_name: null,
  type: "cash",
  subtype: null,
  currency: "usd",
  balance: "100.00",
  status: "active",
  ...overrides,
});

const wf = (id: string, name: string, overrides: Record<string, unknown> = {}): Account =>
  ({
    id,
    name,
    accountType: "CASH",
    currency: "USD",
    isDefault: false,
    isActive: true,
    trackingMode: "HOLDINGS",
    ...overrides,
  }) as unknown as Account;

interface HarnessProps {
  lms: LunchmoneyAccount[];
  wfs?: Account[];
  saved?: AccountMapping;
  balances?: Record<string, number>;
  onFinish?: (o: { importBalances: boolean }) => Promise<void>;
  onCancel?: () => void;
  saving?: boolean;
}

function Harness({
  lms,
  wfs = [],
  saved = {},
  balances = {},
  onFinish = vi.fn().mockResolvedValue(undefined),
  onCancel = vi.fn(),
  saving = false,
}: HarnessProps) {
  const [draft, setDraft] = useState<AccountMapping>(saved);
  const vm = buildAccountViewModel(lms, wfs, draft, saved, balances);
  return (
    <LinkWizard
      vm={vm}
      saving={saving}
      onChoose={(id, entry) => setDraft((d) => ({ ...d, [id]: entry }))}
      onCancel={onCancel}
      onFinish={onFinish}
    />
  );
}

const next = () => userEvent.click(screen.getByRole("button", { name: "Next" }));

describe("LinkWizard", () => {
  it("shows one Lunch Money account at a time, with progress and its balance", () => {
    render(<Harness lms={[lm(1, { balance: "1468.64", currency: "gbp" }), lm(2)]} />);
    expect(screen.getByText("Account 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByRole("heading", { name: "Account 1" })).toBeInTheDocument();
    expect(screen.getByText("£1,468.64")).toBeInTheDocument();
  });

  it("offers Wealthfolio accounts with their balances, plus create and skip", () => {
    render(
      <Harness
        lms={[lm(1)]}
        wfs={[wf("w1", "Everyday"), wf("w2", "Savings")]}
        balances={{ w1: 100, w2: 2500 }}
      />,
    );
    const options = within(screen.getByRole("radiogroup")).getAllByRole("radio");
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining("Everyday"),
      expect.stringContaining("Savings"),
      expect.stringContaining("Create a new Wealthfolio account"),
      expect.stringContaining("Skip"),
    ]);
    expect(options[0]).toHaveTextContent("$100.00");
    expect(options[0]).toHaveTextContent("Suggested");
    expect(options[0]).toHaveTextContent("Balance matches");
    expect(options[1]).toHaveTextContent("$2,500.00");
    // Nothing chosen yet → Skip is the current choice
    expect(options[3]).toHaveAttribute("aria-checked", "true");
  });

  it("describes the account that 'create' would make", () => {
    render(<Harness lms={[lm(1, { currency: "gbp", institution_name: "First Direct" })]} />);
    expect(
      screen.getByRole("radio", { name: /Create a new Wealthfolio account/ }),
    ).toHaveTextContent("Cash account in GBP, grouped under First Direct");
  });

  it("shows accounts in another currency but doesn't let them be linked", async () => {
    render(
      <Harness
        lms={[lm(1, { currency: "gbp" })]}
        wfs={[wf("w1", "Euro account", { currency: "EUR" })]}
      />,
    );
    const option = screen.getByRole("radio", { name: /Euro account/ });
    expect(option).toHaveTextContent("Different currency (EUR) — can’t link");
    expect(option).toBeDisabled();
    await userEvent.click(option);
    expect(option).toHaveAttribute("aria-checked", "false");
  });

  it("remembers each choice when moving back and forward", async () => {
    render(<Harness lms={[lm(1), lm(2)]} wfs={[wf("w1", "Everyday")]} />);
    await userEvent.click(screen.getByRole("radio", { name: /Everyday/ }));
    expect(screen.getByRole("radio", { name: /Everyday/ })).toHaveAttribute("aria-checked", "true");
    await next();
    expect(screen.getByText("Account 2 of 2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("radio", { name: /Everyday/ })).toHaveAttribute("aria-checked", "true");
  });

  it("doesn't offer an account already chosen for an earlier Lunch Money account", async () => {
    render(<Harness lms={[lm(1), lm(2)]} wfs={[wf("w1", "Everyday"), wf("w2", "Savings")]} />);
    await userEvent.click(screen.getByRole("radio", { name: /Everyday/ }));
    await next();
    expect(screen.queryByRole("radio", { name: /Everyday/ })).toBeNull();
    expect(screen.getByRole("radio", { name: /Savings/ })).toBeInTheDocument();
  });

  it("disables Back on the first account", () => {
    render(<Harness lms={[lm(1)]} />);
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });

  it("cancels", async () => {
    const onCancel = vi.fn();
    render(<Harness lms={[lm(1)]} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });

  describe("review", () => {
    async function reachReview() {
      await userEvent.click(screen.getByRole("radio", { name: /Everyday/ }));
      await next();
      await userEvent.click(
        screen.getByRole("radio", { name: /Create a new Wealthfolio account/ }),
      );
      await next();
      await userEvent.click(screen.getByRole("button", { name: "Review changes" }));
    }

    it("reviews every action before anything is saved", async () => {
      render(
        <Harness
          lms={[lm(1), lm(2), lm(3, { display_name: "Old card" })]}
          wfs={[wf("w1", "Everyday")]}
          balances={{ w1: 40 }}
        />,
      );
      await reachReview();

      expect(screen.getByRole("heading", { name: "Review changes" })).toBeInTheDocument();
      expect(screen.getByText("Accounts to link:")).toBeInTheDocument();
      expect(screen.getByText("Account 1 → Everyday")).toBeInTheDocument();
      expect(screen.getByText("Accounts to create:")).toBeInTheDocument();
      expect(screen.getByText("Skipped:")).toBeInTheDocument();
      expect(screen.getByText("Old card")).toBeInTheDocument();

      const imports = screen.getByRole("list", { name: "Balances to import" });
      expect(within(imports).getByText(/Everyday: \$40\.00 → \$100\.00/)).toBeInTheDocument();
      expect(within(imports).getByText(/Account 2 \(new account\): \$100\.00/)).toBeInTheDocument();
    });

    it("applies the links and imports balances by default", async () => {
      const onFinish = vi.fn().mockResolvedValue(undefined);
      render(
        <Harness lms={[lm(1), lm(2), lm(3)]} wfs={[wf("w1", "Everyday")]} onFinish={onFinish} />,
      );
      await reachReview();
      expect(
        screen.getByRole("checkbox", { name: /Import Lunch Money balances now/ }),
      ).toBeChecked();
      await userEvent.click(screen.getByRole("button", { name: "Apply changes" }));
      expect(onFinish).toHaveBeenCalledWith({ importBalances: true });
    });

    it("can apply the links without importing", async () => {
      const onFinish = vi.fn().mockResolvedValue(undefined);
      render(
        <Harness lms={[lm(1), lm(2), lm(3)]} wfs={[wf("w1", "Everyday")]} onFinish={onFinish} />,
      );
      await reachReview();
      await userEvent.click(
        screen.getByRole("checkbox", { name: /Import Lunch Money balances now/ }),
      );
      await userEvent.click(screen.getByRole("button", { name: "Apply changes" }));
      expect(onFinish).toHaveBeenCalledWith({ importBalances: false });
    });

    it("goes back to the last account", async () => {
      render(<Harness lms={[lm(1), lm(2), lm(3)]} wfs={[wf("w1", "Everyday")]} />);
      await reachReview();
      await userEvent.click(screen.getByRole("button", { name: "Back" }));
      expect(screen.getByText("Account 3 of 3")).toBeInTheDocument();
    });

    it("says so, and can't be applied, when nothing would change", async () => {
      render(<Harness lms={[lm(1)]} />);
      await userEvent.click(screen.getByRole("button", { name: "Review changes" }));
      expect(screen.getByText("No changes — every account is skipped.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Apply changes" })).toBeDisabled();
    });

    it("shows progress while saving", async () => {
      render(<Harness lms={[lm(1)]} wfs={[wf("w1", "Everyday")]} saving />);
      await userEvent.click(screen.getByRole("radio", { name: /Everyday/ }));
      await userEvent.click(screen.getByRole("button", { name: "Review changes" }));
      expect(screen.getByRole("button", { name: /Applying/ })).toBeDisabled();
    });
  });
});
