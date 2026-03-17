import { describe, expect, it } from "vitest";
import { classifyChanges } from "../classifyChanges";
import type { LunchmoneyAccount } from "../lunchmoney";
import type { Account } from "@wealthfolio/addon-sdk";
import type { AccountMapping } from "../../types";

const lm = (id: number): LunchmoneyAccount => ({
  id,
  name: `LM ${id}`,
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

describe("classifyChanges", () => {
  it("classifies a new create entry", () => {
    const draft: AccountMapping = { 1: { type: "create" } };
    const result = classifyChanges(draft, {}, [lm(1)], []);
    expect(result.toCreate).toHaveLength(1);
    expect(result.toCreate[0].lm.id).toBe(1);
    expect(result.toCreate[0].wasLinkedTo).toBeUndefined();
    expect(result.hasChanges).toBe(true);
  });

  it("classifies create with wasLinkedTo when previously linked", () => {
    const draft: AccountMapping = { 1: { type: "create" } };
    const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    const result = classifyChanges(draft, saved, [lm(1)], [wf("w1")]);
    expect(result.toCreate[0].wasLinkedTo?.name).toBe("WF w1");
  });

  it("classifies a new link (previously ignored)", () => {
    const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    const result = classifyChanges(draft, {}, [lm(1)], [wf("w1")]);
    expect(result.toLink).toHaveLength(1);
    expect(result.hasChanges).toBe(true);
  });

  it("classifies a new link when saved was ignore type", () => {
    const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    const saved: AccountMapping = { 1: { type: "ignore" } };
    const result = classifyChanges(draft, saved, [lm(1)], [wf("w1")]);
    expect(result.toLink).toHaveLength(1);
  });

  it("classifies a relink when wf account changes", () => {
    const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "w2" } };
    const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    const result = classifyChanges(draft, saved, [lm(1)], [wf("w1"), wf("w2")]);
    expect(result.toRelink).toHaveLength(1);
    expect(result.toRelink[0].from.name).toBe("WF w1");
    expect(result.toRelink[0].to.name).toBe("WF w2");
    expect(result.hasChanges).toBe(true);
  });

  it("classifies as link (not relink) when old wf account is missing", () => {
    const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "w2" } };
    const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "gone" } };
    const result = classifyChanges(draft, saved, [lm(1)], [wf("w2")]);
    expect(result.toLink).toHaveLength(1);
    expect(result.toRelink).toHaveLength(0);
  });

  it("classifies unchanged link", () => {
    const entry = { type: "existing" as const, wfAccountId: "w1" };
    const draft: AccountMapping = { 1: entry };
    const result = classifyChanges(draft, { 1: entry }, [lm(1)], [wf("w1")]);
    expect(result.unchanged).toHaveLength(1);
    expect(result.hasChanges).toBe(false);
  });

  it("classifies unlink when saved=existing and draft=ignore", () => {
    const draft: AccountMapping = { 1: { type: "ignore" } };
    const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    const result = classifyChanges(draft, saved, [lm(1)], [wf("w1")]);
    expect(result.toUnlink).toHaveLength(1);
    expect(result.hasChanges).toBe(true);
  });

  it("classifies unlink when saved=existing and draft has no entry", () => {
    const saved: AccountMapping = { 1: { type: "existing", wfAccountId: "w1" } };
    const result = classifyChanges({}, saved, [lm(1)], [wf("w1")]);
    expect(result.toUnlink).toHaveLength(1);
  });

  it("returns hasChanges false when all unchanged", () => {
    const entry = { type: "existing" as const, wfAccountId: "w1" };
    const result = classifyChanges({ 1: entry }, { 1: entry }, [lm(1)], [wf("w1")]);
    expect(result.hasChanges).toBe(false);
  });

  it("skips entries with unknown lm ids", () => {
    const draft: AccountMapping = { 99: { type: "create" } };
    const result = classifyChanges(draft, {}, [], []);
    expect(result.toCreate).toHaveLength(0);
  });

  it("skips existing entries when wf account is missing", () => {
    const draft: AccountMapping = { 1: { type: "existing", wfAccountId: "missing" } };
    const result = classifyChanges(draft, {}, [lm(1)], []);
    expect(result.toLink).toHaveLength(0);
  });
});
