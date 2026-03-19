import { describe, expect, it } from "vitest";
import { buildAccountViewModel } from "../accountViewModel";
import type { LunchmoneyAccount } from "../lunchmoney";
import type { Account } from "@wealthfolio/addon-sdk";
import type { AccountMapping } from "../../types";

const lm = (id: number, overrides: Partial<LunchmoneyAccount> = {}): LunchmoneyAccount => ({
  id,
  name: `LM ${id}`,
  display_name: null,
  type: "cash",
  subtype: null,
  currency: "usd",
  balance: "100.00",
  status: "active",
  ...overrides,
});

const wf = (id: string, overrides: Partial<Account> = {}): Account =>
  ({
    id,
    name: `WF ${id}`,
    accountType: "CASH",
    currency: "USD",
    isDefault: false,
    isActive: true,
    trackingMode: "HOLDINGS",
    ...overrides,
  }) as unknown as Account;

describe("buildAccountViewModel", () => {
  describe("rows", () => {
    it("returns one row per lm account in source order", () => {
      const vm = buildAccountViewModel([lm(1), lm(2), lm(3)], [], {}, {}, {});
      expect(vm.rows).toHaveLength(3);
      expect(vm.rows.map((r) => r.lm.id)).toEqual([1, 2, 3]);
    });

    it("resolves absent draft entry to ignore", () => {
      const vm = buildAccountViewModel([lm(1)], [], {}, {}, {});
      expect(vm.rows[0].entry).toEqual({ type: "ignore" });
    });

    describe("isLinked", () => {
      it("is true for existing entry", () => {
        const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
        const vm = buildAccountViewModel([lm(1)], [wf("w1")], draft, {}, {});
        expect(vm.rows[0].isLinked).toBe(true);
      });

      it("is true for create entry", () => {
        const draft: AccountMapping = { 1: { type: "create" } };
        const vm = buildAccountViewModel([lm(1)], [], draft, {}, {});
        expect(vm.rows[0].isLinked).toBe(true);
      });

      it("is false for ignore entry", () => {
        const draft: AccountMapping = { 1: { type: "ignore" } };
        const vm = buildAccountViewModel([lm(1)], [], draft, {}, {});
        expect(vm.rows[0].isLinked).toBe(false);
      });

      it("is false when draft entry is absent", () => {
        const vm = buildAccountViewModel([lm(1)], [], {}, {}, {});
        expect(vm.rows[0].isLinked).toBe(false);
      });
    });

    describe("wfAccount", () => {
      it("resolves wfAccount for existing entry", () => {
        const wfAcc = wf("w1");
        const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
        const vm = buildAccountViewModel([lm(1)], [wfAcc], draft, {}, {});
        expect(vm.rows[0].wfAccount).toBe(wfAcc);
      });

      it("returns undefined for unknown wfAccountId", () => {
        const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "missing" } };
        const vm = buildAccountViewModel([lm(1)], [], draft, {}, {});
        expect(vm.rows[0].wfAccount).toBeUndefined();
      });

      it("returns undefined for create entry", () => {
        const draft: AccountMapping = { 1: { type: "create" } };
        const vm = buildAccountViewModel([lm(1)], [], draft, {}, {});
        expect(vm.rows[0].wfAccount).toBeUndefined();
      });

      it("returns undefined for ignore entry", () => {
        const vm = buildAccountViewModel([lm(1)], [], {}, {}, {});
        expect(vm.rows[0].wfAccount).toBeUndefined();
      });
    });

    describe("balance", () => {
      it("parses lmBalance from balance string", () => {
        const vm = buildAccountViewModel([lm(1, { balance: "1234.56" })], [], {}, {}, {});
        expect(vm.rows[0].lmBalance).toBe(1234.56);
      });

      it("returns wfBalance from wfCashBalances when savedMapping entry is existing", () => {
        const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
        const vm = buildAccountViewModel([lm(1)], [], {}, saved, { w1: 200.0 });
        expect(vm.rows[0].wfBalance).toBe(200.0);
      });

      it("returns null wfBalance when savedEntry is absent", () => {
        const vm = buildAccountViewModel([lm(1)], [], {}, {}, { w1: 200.0 });
        expect(vm.rows[0].wfBalance).toBeNull();
      });

      it("returns null wfBalance when savedEntry is not existing type", () => {
        const saved: AccountMapping = { 1: { type: "ignore" } };
        const vm = buildAccountViewModel([lm(1)], [], {}, saved, { w1: 200.0 });
        expect(vm.rows[0].wfBalance).toBeNull();
      });

      it("returns null wfBalance when wfAccountId not in wfCashBalances", () => {
        const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
        const vm = buildAccountViewModel([lm(1)], [], {}, saved, {});
        expect(vm.rows[0].wfBalance).toBeNull();
      });

      it("computes balanceDelta as wfBalance - lmBalance", () => {
        const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
        const vm = buildAccountViewModel([lm(1, { balance: "100.00" })], [], {}, saved, {
          w1: 150.0,
        });
        expect(vm.rows[0].balanceDelta).toBeCloseTo(50.0);
      });

      it("balanceDelta is null when wfBalance is null", () => {
        const vm = buildAccountViewModel([lm(1)], [], {}, {}, {});
        expect(vm.rows[0].balanceDelta).toBeNull();
      });

      it("balancesMatch is true when |delta| < 0.005", () => {
        const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
        const vm = buildAccountViewModel([lm(1, { balance: "100.00" })], [], {}, saved, {
          w1: 100.004,
        });
        expect(vm.rows[0].balancesMatch).toBe(true);
      });

      it("balancesMatch is false when |delta| >= 0.005", () => {
        const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
        const vm = buildAccountViewModel([lm(1, { balance: "100.00" })], [], {}, saved, {
          w1: 100.01,
        });
        expect(vm.rows[0].balancesMatch).toBe(false);
      });

      it("balancesMatch is false when wfBalance is null", () => {
        const vm = buildAccountViewModel([lm(1)], [], {}, {}, {});
        expect(vm.rows[0].balancesMatch).toBe(false);
      });
    });
  });

  describe("groups", () => {
    it("groups accounts by institution_name", () => {
      const vm = buildAccountViewModel(
        [
          lm(1, { institution_name: "Bank A" }),
          lm(2, { institution_name: "Bank A" }),
          lm(3, { institution_name: "Bank B" }),
        ],
        [],
        {},
        {},
        {},
      );
      expect(vm.groups).toHaveLength(2);
      expect(vm.groups[0].institution).toBe("Bank A");
      expect(vm.groups[0].rows).toHaveLength(2);
      expect(vm.groups[1].institution).toBe("Bank B");
      expect(vm.groups[1].rows).toHaveLength(1);
    });

    it("uses 'Other' as fallback institution when institution_name is absent", () => {
      const vm = buildAccountViewModel([lm(1)], [], {}, {}, {});
      expect(vm.groups).toHaveLength(1);
      expect(vm.groups[0].institution).toBe("Other");
    });

    it("group rows reference the same AccountRowVM objects as the rows array", () => {
      const vm = buildAccountViewModel([lm(1, { institution_name: "Bank A" })], [], {}, {}, {});
      expect(vm.groups[0].rows[0]).toBe(vm.rows[0]);
    });
  });

  describe("wfAccounts", () => {
    it("exposes the wfAccounts input list", () => {
      const accounts = [wf("w1"), wf("w2")];
      const vm = buildAccountViewModel([], accounts, {}, {}, {});
      expect(vm.wfAccounts).toBe(accounts);
    });
  });

  describe("linkedCount", () => {
    it("counts existing entries in savedMapping", () => {
      const saved: AccountMapping = {
        1: { type: "existing", wfAccountId: "w1" },
        2: { type: "existing", wfAccountId: "w2" },
        3: { type: "ignore" },
      };
      const vm = buildAccountViewModel([], [], {}, saved, {});
      expect(vm.linkedCount).toBe(2);
    });

    it("does not count create entries in savedMapping", () => {
      const saved: AccountMapping = { 1: { type: "create" } };
      const vm = buildAccountViewModel([], [], {}, saved, {});
      expect(vm.linkedCount).toBe(0);
    });

    it("returns 0 for empty savedMapping", () => {
      const vm = buildAccountViewModel([], [], {}, {}, {});
      expect(vm.linkedCount).toBe(0);
    });
  });

  describe("isDirty", () => {
    it("is false when draft equals savedMapping", () => {
      const mapping: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
      const vm = buildAccountViewModel([], [], mapping, mapping, {});
      expect(vm.isDirty).toBe(false);
    });

    it("is true when draft differs from savedMapping", () => {
      const draft: AccountMapping = { 1: { type: "create" } };
      const vm = buildAccountViewModel([], [], draft, {}, {});
      expect(vm.isDirty).toBe(true);
    });
  });

  describe("claimedWfIds", () => {
    it("returns set of wfAccountIds from existing draft entries", () => {
      const draft: AccountMapping = {
        1: { type: "existing", wfAccountId: "w1" },
        2: { type: "existing", wfAccountId: "w2" },
        3: { type: "ignore" },
        4: { type: "create" },
      };
      const vm = buildAccountViewModel([], [], draft, {}, {});
      expect(vm.claimedWfIds).toEqual(new Set(["w1", "w2"]));
    });

    it("returns empty set when no existing entries in draft", () => {
      const vm = buildAccountViewModel([], [], {}, {}, {});
      expect(vm.claimedWfIds.size).toBe(0);
    });
  });

  describe("changes (lazy getter)", () => {
    it("classifies toLink correctly", () => {
      const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
      const vm = buildAccountViewModel([lm(1)], [wf("w1")], draft, {}, {});
      expect(vm.changes.toLink).toHaveLength(1);
      expect(vm.changes.hasChanges).toBe(true);
    });

    it("classifies a new link when saved was ignore type", () => {
      const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
      const saved: AccountMapping = { 1: { type: "ignore" } };
      const vm = buildAccountViewModel([lm(1)], [wf("w1")], draft, saved, {});
      expect(vm.changes.toLink).toHaveLength(1);
    });

    it("classifies toCreate correctly", () => {
      const draft: AccountMapping = { 1: { type: "create" } };
      const vm = buildAccountViewModel([lm(1)], [], draft, {}, {});
      expect(vm.changes.toCreate).toHaveLength(1);
    });

    it("classifies create with wasLinkedTo when previously linked", () => {
      const draft: AccountMapping = { 1: { type: "create" } };
      const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
      const vm = buildAccountViewModel([lm(1)], [wf("w1")], draft, saved, {});
      expect(vm.changes.toCreate[0].wasLinkedTo?.name).toBe("WF w1");
    });

    it("classifies toUnlink correctly", () => {
      const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
      const vm = buildAccountViewModel([lm(1)], [wf("w1")], {}, saved, {});
      expect(vm.changes.toUnlink).toHaveLength(1);
    });

    it("classifies unlink when saved=existing and draft=ignore", () => {
      const draft: AccountMapping = { 1: { type: "ignore" } };
      const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
      const vm = buildAccountViewModel([lm(1)], [wf("w1")], draft, saved, {});
      expect(vm.changes.toUnlink).toHaveLength(1);
      expect(vm.changes.hasChanges).toBe(true);
    });

    it("classifies a relink when wf account changes", () => {
      const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "w2" } };
      const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
      const vm = buildAccountViewModel([lm(1)], [wf("w1"), wf("w2")], draft, saved, {});
      expect(vm.changes.toRelink).toHaveLength(1);
      expect(vm.changes.toRelink[0].from.name).toBe("WF w1");
      expect(vm.changes.toRelink[0].to.name).toBe("WF w2");
    });

    it("classifies as link (not relink) when old wf account is missing", () => {
      const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "w2" } };
      const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "gone" } };
      const vm = buildAccountViewModel([lm(1)], [wf("w2")], draft, saved, {});
      expect(vm.changes.toLink).toHaveLength(1);
      expect(vm.changes.toRelink).toHaveLength(0);
    });

    it("classifies unchanged link", () => {
      const entry = { type: "existing" as const, wfAccountId: "w1" };
      const vm = buildAccountViewModel([lm(1)], [wf("w1")], { 1: entry }, { 1: entry }, {});
      expect(vm.changes.unchanged).toHaveLength(1);
      expect(vm.changes.hasChanges).toBe(false);
    });

    it("skips entries with unknown lm ids", () => {
      const draft: AccountMapping = { 99: { type: "create" } };
      const vm = buildAccountViewModel([], [], draft, {}, {});
      expect(vm.changes.toCreate).toHaveLength(0);
    });

    it("skips existing entries when wf account is missing", () => {
      const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "missing" } };
      const vm = buildAccountViewModel([lm(1)], [], draft, {}, {});
      expect(vm.changes.toLink).toHaveLength(0);
    });

    it("returns same object reference on repeated access (memoized)", () => {
      const draft: AccountMapping = { 1: { type: "create" } };
      const vm = buildAccountViewModel([lm(1)], [], draft, {}, {});
      expect(vm.changes).toBe(vm.changes);
    });

    it("hasChanges is false when draft equals savedMapping", () => {
      const entry = { type: "existing" as const, wfAccountId: "w1" };
      const vm = buildAccountViewModel([lm(1)], [wf("w1")], { 1: entry }, { 1: entry }, {});
      expect(vm.changes.hasChanges).toBe(false);
    });
  });

  describe("filtered()", () => {
    const accounts = [
      lm(1, { name: "Checking", display_name: "My Checking", institution_name: "Big Bank" }),
      lm(2, { name: "Savings", institution_name: "Big Bank" }),
      lm(3, { name: "Credit Card" }),
    ];

    it("returns all rows with empty search and tab=all", () => {
      const vm = buildAccountViewModel(accounts, [], {}, {}, {});
      const filtered = vm.filtered("", "all");
      expect(filtered.rows).toHaveLength(3);
    });

    it("returns this (identity) when search is empty and tab is all", () => {
      const vm = buildAccountViewModel(accounts, [], {}, {}, {});
      expect(vm.filtered("", "all")).toBe(vm);
    });

    it("filters by name", () => {
      const vm = buildAccountViewModel(accounts, [], {}, {}, {});
      const filtered = vm.filtered("savings", "all");
      expect(filtered.rows.map((r) => r.lm.id)).toEqual([2]);
    });

    it("filters by display_name", () => {
      const vm = buildAccountViewModel(accounts, [], {}, {}, {});
      const filtered = vm.filtered("my checking", "all");
      expect(filtered.rows.map((r) => r.lm.id)).toEqual([1]);
    });

    it("filters by institution_name", () => {
      const vm = buildAccountViewModel(accounts, [], {}, {}, {});
      const filtered = vm.filtered("big bank", "all");
      expect(filtered.rows.map((r) => r.lm.id)).toEqual([1, 2]);
    });

    it("is case-insensitive", () => {
      const vm = buildAccountViewModel(accounts, [], {}, {}, {});
      expect(vm.filtered("BIG BANK", "all").rows).toHaveLength(2);
    });

    it("returns linked accounts only when tab=linked", () => {
      const draft: AccountMapping = {
        1: { type: "existing", wfAccountId: "w1" },
        2: { type: "create" },
      };
      const vm = buildAccountViewModel(accounts, [wf("w1")], draft, {}, {});
      const filtered = vm.filtered("", "linked");
      expect(filtered.rows.map((r) => r.lm.id)).toEqual([1, 2]);
    });

    it("returns skipped accounts only when tab=skipped", () => {
      const draft: AccountMapping = {
        1: { type: "existing", wfAccountId: "w1" },
        2: { type: "ignore" },
      };
      const vm = buildAccountViewModel(accounts, [wf("w1")], draft, {}, {});
      const filtered = vm.filtered("", "skipped");
      expect(filtered.rows.map((r) => r.lm.id)).toEqual([2, 3]);
    });

    it("combines search query with tab filter", () => {
      const draft: AccountMapping = {
        1: { type: "existing", wfAccountId: "w1" },
        2: { type: "existing", wfAccountId: "w2" },
      };
      const vm = buildAccountViewModel(accounts, [wf("w1"), wf("w2")], draft, {}, {});
      const filtered = vm.filtered("big bank", "linked");
      expect(filtered.rows.map((r) => r.lm.id)).toEqual([1, 2]);
    });

    it("re-groups filtered rows by institution", () => {
      const vm = buildAccountViewModel(accounts, [], {}, {}, {});
      const filtered = vm.filtered("big bank", "all");
      expect(filtered.groups).toHaveLength(1);
      expect(filtered.groups[0].institution).toBe("Big Bank");
      expect(filtered.groups[0].rows).toHaveLength(2);
    });

    it("shares aggregate state with the parent vm", () => {
      const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
      const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
      const vm = buildAccountViewModel(accounts, [wf("w1")], draft, saved, {});
      const filtered = vm.filtered("savings", "all");
      // linkedCount is over ALL accounts, not just filtered
      expect(filtered.linkedCount).toBe(vm.linkedCount);
      expect(filtered.isDirty).toBe(vm.isDirty);
      expect(filtered.claimedWfIds).toBe(vm.claimedWfIds);
      expect(filtered.wfAccounts).toBe(vm.wfAccounts);
    });

    it("returns empty rows when no accounts match", () => {
      const vm = buildAccountViewModel(accounts, [], {}, {}, {});
      const filtered = vm.filtered("zzznomatch", "all");
      expect(filtered.rows).toHaveLength(0);
      expect(filtered.groups).toHaveLength(0);
    });
  });
});
