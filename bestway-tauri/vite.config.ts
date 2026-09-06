import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  // Only expose explicitly intended env vars to the client bundle.
  // Adding a new BESTWAY_* secret on the build host would otherwise be baked into the JS.
  envPrefix: ["BESTWAY_", "VITE_"],
  build: {
    // Do not emit sourcemaps in production — leaks source and aids exploit chaining.
    sourcemap: false,
    minify: "esbuild",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
