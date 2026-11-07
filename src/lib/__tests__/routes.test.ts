import { describe, expect, it } from "vitest";
import manifest from "../../../manifest.json";
import { MAIN_ROUTE, SETTINGS_ROUTE } from "../routes";

// The host mounts declared routes at /addons/<manifest.id>[/<path>] and requires
// the runtime router.add({ id }) to match contributes.routes[].id.
describe("routes", () => {
  const declared = manifest.contributes.routes as { id: string; path?: string }[];

  it.each([MAIN_ROUTE, SETTINGS_ROUTE])("$id is declared in the manifest", (route) => {
    const entry = declared.find((r) => r.id === route.id);
    expect(entry).toBeDefined();
    const expectedPath = ["/addons", manifest.id, entry!.path].filter(Boolean).join("/");
    expect(route.path).toBe(expectedPath);
  });

  it("the sidebar links to the main route", () => {
    expect(manifest.contributes.links.sidebar.map((l) => l.route)).toEqual([MAIN_ROUTE.id]);
  });
});
