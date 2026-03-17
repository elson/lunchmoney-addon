import { describe, expect, it } from "vitest";
import { filterAccounts } from "../filterAccounts";
import type { LunchmoneyAccount } from "../lunchmoney";
import type { AccountMapping } from "../../types";

const account = (
  id: number,
  name: string,
  display_name: string | null = null,
  institution_name?: string,
): LunchmoneyAccount => ({
  id,
  name,
  display_name,
  type: "cash",
  subtype: null,
  currency: "usd",
  balance: "0.00",
  status: "active",
  institution_name,
});

const accounts = [
  account(1, "Checking", "My Checking", "Big Bank"),
  account(2, "Savings", null, "Big Bank"),
  account(3, "Credit Card", null),
];

describe("filterAccounts", () => {
  it("returns all accounts with no query and tab=all", () => {
    const result = filterAccounts(accounts, "", "all", {});
    expect(result).toHaveLength(3);
  });

  it("returns empty array for empty input", () => {
    expect(filterAccounts([], "savings", "all", {})).toEqual([]);
  });

  it("filters by name", () => {
    const result = filterAccounts(accounts, "savings", "all", {});
    expect(result.map((a) => a.id)).toEqual([2]);
  });

  it("filters by display_name", () => {
    const result = filterAccounts(accounts, "my checking", "all", {});
    expect(result.map((a) => a.id)).toEqual([1]);
  });

  it("filters by institution_name", () => {
    const result = filterAccounts(accounts, "big bank", "all", {});
    expect(result.map((a) => a.id)).toEqual([1, 2]);
  });

  it("returns linked accounts only when filterTab=linked", () => {
    const draft: AccountMapping = {
      1: { type: "existing", wfAccountId: "w1" },
      2: { type: "create" },
    };
    const result = filterAccounts(accounts, "", "linked", draft);
    expect(result.map((a) => a.id)).toEqual([1, 2]);
  });

  it("returns skipped accounts only when filterTab=skipped", () => {
    const draft: AccountMapping = {
      1: { type: "existing", wfAccountId: "w1" },
      2: { type: "ignore" },
    };
    const result = filterAccounts(accounts, "", "skipped", draft);
    // 2 is explicitly ignored, 3 has no entry (treated as skipped)
    expect(result.map((a) => a.id)).toEqual([2, 3]);
  });

  it("combines search query with tab filter", () => {
    const draft: AccountMapping = {
      1: { type: "existing", wfAccountId: "w1" },
      2: { type: "existing", wfAccountId: "w2" },
    };
    const result = filterAccounts(accounts, "big bank", "linked", draft);
    // Both 1 and 2 match "big bank" and are linked
    expect(result.map((a) => a.id)).toEqual([1, 2]);
  });
});
