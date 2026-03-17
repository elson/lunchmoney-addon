/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import externalGlobals from "rollup-plugin-external-globals";
import path from "path";

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  // Only force production mode for the actual build, not for tests
  define: command === "build" ? { "process.env.NODE_ENV": JSON.stringify("production") } : {},
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    alias: {
      "@wealthfolio/ui": path.resolve(__dirname, "src/test/mocks/wealthfolio-ui.tsx"),
    },
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/hooks/**", "src/components/**", "src/pages/**"],
      exclude: ["src/addon.tsx", "src/types/**", "src/lib/secrets.ts", "src/**/index.ts"],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
      reporter: ["text", "html", "lcov"],
    },
  },
  build: {
    lib: {
      entry: "src/addon.tsx",
      fileName: () => "addon.js",
      formats: ["es"],
    },
    rollupOptions: {
      external: ["react", "react-dom"],
      plugins: [
        externalGlobals({
          react: "React",
          "react-dom": "ReactDOM",
        }),
      ],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
      },
    },
    outDir: "dist",
    minify: false,
    sourcemap: false,
  },
}));
