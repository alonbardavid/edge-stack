import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

const persistTo = process.env.WORKER_PERSIST_TO;

export default defineConfig({
  plugins: [
    cloudflare({
      // Pins the output to dist/worker. Without it the dir is named after the
      // worker in wrangler.jsonc, and every deploy path would depend on it.
      viteEnvironment: { name: "worker" },
      persistState: persistTo ? { path: persistTo } : true,
    }),
  ],
  server: {
    // Both frontend dev servers proxy /api to this port.
    port: 8301,
    strictPort: true,
  },
});
