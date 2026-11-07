import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AddonContext } from "@wealthfolio/addon-sdk";
import SettingsPage from "../SettingsPage";
import { createMockCtx } from "../../test/mockCtx";

/** A ctx whose secret store is real (in memory) and whose /me answers with `meStatus`. */
function setup({ savedToken = null as string | null, meStatus = 200 } = {}) {
  const ctx = createMockCtx();
  let token = savedToken;
  vi.mocked(ctx.api.secrets.get).mockImplementation(async () => token);
  vi.mocked(ctx.api.secrets.set).mockImplementation(async (_k, v) => {
    token = v;
  });
  vi.mocked(ctx.api.secrets.delete).mockImplementation(async () => {
    token = null;
  });
  mockMe(ctx, meStatus);
  render(<SettingsPage ctx={ctx} />);
  return ctx;
}

function mockMe(ctx: AddonContext, status: number) {
  vi.mocked(ctx.api.network.request).mockResolvedValue({
    status,
    headers: {},
    body: status === 200 ? JSON.stringify({ name: "Stephen", budget_name: "Family budget" }) : "",
  });
}

const tokenField = () => screen.getByLabelText("Access token");

describe("SettingsPage", () => {
  it("renders the page heading", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Lunch Money Settings" })).toBeInTheDocument();
  });

  it("explains where to get a token and that it stays private", () => {
    setup();
    expect(screen.getByText(/Settings → Developers/)).toBeInTheDocument();
    expect(screen.getByText(/only ever sent to api\.lunchmoney\.dev/)).toBeInTheDocument();
  });

  it("shows 'Not connected' and keeps Save disabled when no token is saved", async () => {
    setup();
    expect(await screen.findByText("Not connected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save and connect" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Remove token" })).toBeNull();
  });

  it("checks a saved token on open, without putting the token back in the field", async () => {
    setup({ savedToken: "secret-token" });
    expect(await screen.findByText("Connected to Family budget as Stephen")).toBeInTheDocument();
    expect(tokenField()).toHaveValue("");
    expect(tokenField()).toHaveAttribute(
      "placeholder",
      "Paste a new token to replace the saved one",
    );
  });

  it("saves a new token and confirms the connection", async () => {
    const ctx = setup();
    await userEvent.type(tokenField(), "new-token");
    await userEvent.click(screen.getByRole("button", { name: "Save and connect" }));

    expect(ctx.api.secrets.set).toHaveBeenCalledWith("lunchmoney-api-key", "new-token");
    expect(await screen.findByText("Connected to Family budget as Stephen")).toBeInTheDocument();
    expect(tokenField()).toHaveValue("");
  });

  it("says so when Lunch Money rejects the token", async () => {
    setup({ meStatus: 401 });
    await userEvent.type(tokenField(), "bad-token");
    await userEvent.click(screen.getByRole("button", { name: "Save and connect" }));
    expect(
      await screen.findByText("Lunch Money rejected this token. Check it and try again."),
    ).toBeInTheDocument();
  });

  it("reports other connection problems", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("t");
    vi.mocked(ctx.api.network.request).mockRejectedValue(new Error("offline"));
    render(<SettingsPage ctx={ctx} />);
    expect(await screen.findByText("Couldn't reach Lunch Money: offline")).toBeInTheDocument();
  });

  it("can show the token being typed", async () => {
    setup();
    expect(tokenField()).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show token" }));
    expect(tokenField()).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: "Hide token" }));
    expect(tokenField()).toHaveAttribute("type", "password");
  });

  it("asks before removing the token, and removes it on confirm", async () => {
    const ctx = setup({ savedToken: "secret-token" });
    await userEvent.click(await screen.findByRole("button", { name: "Remove token" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(/Linked accounts stay linked/);
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(ctx.api.secrets.delete).toHaveBeenCalledWith("lunchmoney-api-key");
    expect(await screen.findByText("Not connected")).toBeInTheDocument();
  });

  it("keeps the token if removal is cancelled", async () => {
    const ctx = setup({ savedToken: "secret-token" });
    await userEvent.click(await screen.findByRole("button", { name: "Remove token" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(ctx.api.secrets.delete).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("goes back to the accounts page", async () => {
    const ctx = setup();
    await userEvent.click(screen.getByRole("button", { name: "Back to accounts" }));
    expect(ctx.api.navigation.navigate).toHaveBeenCalledWith("/addons/lunchmoney-addon");
  });
});
