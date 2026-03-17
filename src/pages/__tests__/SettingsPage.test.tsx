import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import SettingsPage from "../SettingsPage";
import { createMockCtx } from "../../test/mockCtx";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("SettingsPage", () => {
  it("renders the page heading", () => {
    render(<SettingsPage ctx={createMockCtx()} />);
    expect(screen.getByText("Lunch Money Settings")).toBeInTheDocument();
  });

  it("loads existing api key on mount", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("my-existing-key");
    render(<SettingsPage ctx={ctx} />);
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Enter your Lunch Money API key")).toHaveValue(
        "my-existing-key",
      ),
    );
  });

  it("Save button is disabled when input is empty", () => {
    render(<SettingsPage ctx={createMockCtx()} />);
    expect(screen.getByText("Save")).toBeDisabled();
  });

  it("Save button is enabled when input has value", async () => {
    render(<SettingsPage ctx={createMockCtx()} />);
    await userEvent.type(screen.getByPlaceholderText("Enter your Lunch Money API key"), "abc");
    expect(screen.getByText("Save")).not.toBeDisabled();
  });

  it("calls secrets.set on Save and shows 'Saved!'", async () => {
    const ctx = createMockCtx();
    render(<SettingsPage ctx={ctx} />);
    const input = screen.getByPlaceholderText("Enter your Lunch Money API key");
    await userEvent.type(input, "my-new-key");
    await userEvent.click(screen.getByText("Save"));
    expect(ctx.api.secrets.set).toHaveBeenCalledWith("lunchmoney-api-key", "my-new-key");
    expect(screen.getByText("Saved!")).toBeInTheDocument();
  });

  it("calls secrets.delete on Clear and shows 'Cleared.'", async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.api.secrets.get).mockResolvedValue("existing-key");
    render(<SettingsPage ctx={ctx} />);
    await userEvent.click(screen.getByText("Clear"));
    expect(ctx.api.secrets.delete).toHaveBeenCalled();
    expect(screen.getByText("Cleared.")).toBeInTheDocument();
  });

  it("navigates to main page on Close click", async () => {
    const ctx = createMockCtx();
    render(<SettingsPage ctx={ctx} />);
    await userEvent.click(screen.getByText("Close"));
    expect(ctx.api.navigation.navigate).toHaveBeenCalledWith("/addon/lunch-money");
  });
});
