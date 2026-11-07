import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CompanionVersionAlert } from "../CompanionVersionAlert";
import { createMockCtx } from "../../test/mockCtx";

describe("CompanionVersionAlert", () => {
  it("warns when the sync companion runs a different version", async () => {
    const ctx = createMockCtx();
    await ctx.api.storage.set(
      "lunchmoney-addon:companion",
      JSON.stringify({ version: "0.0.1", lastRunAt: "2026-11-07T06:00:00Z" }),
    );
    render(<CompanionVersionAlert ctx={ctx} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Add-on and sync companion versions differ",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Pull the latest companion image.");
  });

  it("shows nothing when there is no companion", async () => {
    const ctx = createMockCtx();
    const { container } = render(<CompanionVersionAlert ctx={ctx} />);
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });
});
