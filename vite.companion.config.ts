import { defineConfig } from "vite";

// Builds the companion container's entry point into one self-contained Node
// script (companion/dist/main.js), dependencies included, so the image needs
// no node_modules.
export default defineConfig({
  ssr: { noExternal: true },
  build: {
    ssr: "companion/src/main.ts",
    target: "node22",
    outDir: "companion/dist",
    emptyOutDir: true,
    minify: false,
    rollupOptions: { output: { entryFileNames: "main.js", format: "es" } },
  },
});
