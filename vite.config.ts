/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import path from "path";

// Packages the Wealthfolio addon sandbox provides at runtime (see HOST_DEPENDENCIES
// in @wealthfolio/addon-sdk). They must stay external so the addon shares the
// host's single React instance; keep in sync with manifest.json "hostDependencies".
const hostProvidedDependencies = [
  "@tanstack/react-query",
  "@wealthfolio/addon-sdk",
  "@wealthfolio/addon-sdk/host-api",
  "@wealthfolio/addon-sdk/host-dependencies",
  "@wealthfolio/addon-sdk/manifest",
  "@wealthfolio/addon-sdk/permissions",
  "@wealthfolio/addon-sdk/types",
  "@wealthfolio/addon-sdk/utils",
  "@wealthfolio/ui",
  "@wealthfolio/ui/chart",
  "date-fns",
  "lucide-react",
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-dev-runtime",
  "react/jsx-runtime",
  "recharts",
];

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  // Only force production mode for the actual build, not for tests
  define: command === "build" ? { "process.env.NODE_ENV": JSON.stringify("production") } : {},
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "companion/src/**/*.test.ts"],
    alias: {
      "@wealthfolio/ui": path.resolve(__dirname, "src/test/mocks/wealthfolio-ui.tsx"),
    },
    coverage: {
      provider: "v8",
      include: [
        "src/lib/**",
        "src/hooks/**",
        "src/components/**",
        "src/pages/**",
        "companion/src/**",
      ],
      exclude: [
        "src/addon.tsx",
        "src/types/**",
        "src/lib/secrets.ts",
        "src/**/index.ts",
        "companion/src/main.ts",
      ],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
      reporter: ["text", "html", "lcov"],
    },
  },
  build: {
    target: ["chrome107", "edge107", "firefox104", "safari16"],
    lib: {
      entry: "src/addon.tsx",
      fileName: () => "addon.js",
      cssFileName: "addon",
      formats: ["es"],
    },
    rollupOptions: { external: hostProvidedDependencies },
    outDir: "dist",
    minify: false,
    sourcemap: false,
  },
}));
