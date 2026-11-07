// @vitest-environment node
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "vite";

// The addon runs in a sandboxed iframe whose only stylesheet is the host's own
// Tailwind build, which never scans addon sources. Utilities the host doesn't
// happen to use (pl-9, ml-1.5, aria-pressed:…) therefore have no CSS unless the
// addon ships them. These tests build the real bundle and inspect what ships.

const root = path.resolve(__dirname, "../..");
let outDir: string;
let css: string;

beforeAll(async () => {
  outDir = mkdtempSync(path.join(tmpdir(), "lm-addon-build-"));
  await build({
    root,
    configFile: path.join(root, "vite.config.ts"),
    logLevel: "silent",
    build: { outDir, emptyOutDir: true },
  });
  const cssFile = readdirSync(outDir).find((f) => f.endsWith(".css"));
  css = cssFile ? readFileSync(path.join(outDir, cssFile), "utf8") : "";
}, 60_000);

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe("addon stylesheet", () => {
  it("is emitted as dist/addon.css so the sandbox installs it", () => {
    expect(readdirSync(outDir)).toContain("addon.css");
  });

  it.each([
    ".pl-9",
    ".left-3",
    ".ml-1\\.5",
    ".grid-cols-\\[1\\.25rem_minmax\\(0\\,1fr\\)_7rem_1rem_minmax\\(0\\,1fr\\)_9rem\\]",
    ".text-right",
  ])("includes the %s utility the host stylesheet lacks", (selector) => {
    expect(css).toContain(selector);
  });

  it("styles the pressed filter tab from the host's theme colour", () => {
    expect(css).toMatch(/aria-pressed\\:bg-background\[aria-pressed=["']?true["']?\]/);
    expect(css).toContain("var(--background)");
  });

  it("uses the host's radius variable rather than Tailwind's default", () => {
    expect(css).toMatch(/\.rounded-md\s*\{\s*border-radius:\s*calc\(var\(--radius\)/);
  });

  it("ships no reset or theme variables that could restyle the host's components", () => {
    expect(css).not.toMatch(/box-sizing/);
    expect(css).not.toMatch(/:root|:host/);
    expect(css).not.toMatch(/--spacing\s*:/);
  });

  it("does not use Tailwind's default colour palette", () => {
    expect(css).not.toMatch(/\.(text|bg|border)-(red|green|amber|yellow)-\d/);
  });
});

describe("addon source", () => {
  it("uses theme colours, not Tailwind's palette (which the host's theme doesn't provide)", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "__tests__" && entry.name !== "test") walk(full);
        } else if (full.endsWith(".tsx")) {
          const matches = readFileSync(full, "utf8").match(
            /\b(text|bg|border|fill|stroke)-(red|green|amber|yellow|orange|emerald|rose)-\d+/g,
          );
          if (matches) offenders.push(`${path.relative(root, full)}: ${matches.join(", ")}`);
        }
      }
    };
    walk(path.join(root, "src"));
    expect(offenders).toEqual([]);
  });
});
