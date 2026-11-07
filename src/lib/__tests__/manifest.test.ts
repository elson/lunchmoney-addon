import { describe, expect, it } from "vitest";
import manifest from "../../../manifest.json";

function granted(category: string): string[] {
  return manifest.permissions.find((p) => p.category === category)?.functions ?? [];
}

// The host refuses brokered requests unless these are declared, so a missing
// grant only shows up at runtime inside Wealthfolio.
describe("manifest permissions", () => {
  it("grants network.request for the Lunch Money API host", () => {
    expect(granted("network")).toContain("request");
    expect(manifest.network.allowedHosts).toContain("api.lunchmoney.dev");
  });

  it("grants secrets.use so the network broker can inject the API key", () => {
    // fetchJson passes `auth: { type: "bearer", secretKey }`; the host rejects
    // authenticated requests without secrets.use ("not allowed to use network auth secrets").
    expect(granted("secrets")).toContain("use");
  });
});
