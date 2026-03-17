import { describe, expect, it, vi } from "vitest";
import { createWfAccountFromLm, saveSnapshot } from "../wealthfolio";
import { createMockCtx } from "../../test/mockCtx";
import type { LunchmoneyAccount } from "../lunchmoney";

const baseLm: LunchmoneyAccount = {
  id: 1,
  name: "My Account",
  display_name: null,
  type: "cash",
  subtype: null,
  currency: "usd",
  balance: "500.00",
  status: "active",
};

describe("createWfAccountFromLm", () => {
  it("uses display_name when set", async () => {
    const ctx = createMockCtx();
    const lm = { ...baseLm, display_name: "Pretty Name" };
    await createWfAccountFromLm(ctx, lm);
    expect(ctx.api.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Pretty Name" }),
    );
  });

  it("falls back to name when display_name is null", async () => {
    const ctx = createMockCtx();
    await createWfAccountFromLm(ctx, baseLm);
    expect(ctx.api.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "My Account" }),
    );
  });

  it("uppercases currency", async () => {
    const ctx = createMockCtx();
    await createWfAccountFromLm(ctx, baseLm);
    expect(ctx.api.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: "USD" }),
    );
  });

  it("sets group from institution_name", async () => {
    const ctx = createMockCtx();
    const lm = { ...baseLm, institution_name: "Big Bank" };
    await createWfAccountFromLm(ctx, lm);
    expect(ctx.api.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ group: "Big Bank" }),
    );
  });

  it("sets group to undefined when institution_name is absent", async () => {
    const ctx = createMockCtx();
    await createWfAccountFromLm(ctx, baseLm);
    expect(ctx.api.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ group: undefined }),
    );
  });
});

describe("saveSnapshot", () => {
  it("passes correct args to ctx.api.snapshots.save", async () => {
    const ctx = createMockCtx();
    await saveSnapshot(ctx, "wf-42", "usd", "1234.56", "2024-01-15");
    expect(ctx.api.snapshots.save).toHaveBeenCalledWith(
      "wf-42",
      [],
      { USD: "1234.56" },
      "2024-01-15",
    );
  });

  it("uppercases currency key", async () => {
    const ctx = createMockCtx();
    await saveSnapshot(ctx, "wf-1", "eur", "999.00", "2024-06-01");
    expect(ctx.api.snapshots.save).toHaveBeenCalledWith(
      "wf-1",
      [],
      { EUR: "999.00" },
      "2024-06-01",
    );
  });
});
