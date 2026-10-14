import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// Both workers must read one local database, so this one persists into the
// backend's state directory (the e2e run passes its own, relative to here).
const persistTo = process.env.WORKER_PERSIST_TO ?? "../backend/.wrangler/state";

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: "worker" },
      persistState: { path: persistTo },
    }),
  ],
  server: {
    // The admin frontend's dev server proxies /api to this port.
    port: 8302,
    strictPort: true,
  },
});
