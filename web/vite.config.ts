import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Keep frontend requests on /api while Vite proxies to Express.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [tailwindcss()],
  server: { proxy: { "/api": "http://localhost:3000" } },
  build: { outDir: "dist", emptyOutDir: true },
});
