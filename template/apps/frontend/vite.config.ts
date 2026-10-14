import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";

const adminTrailingSlashRedirect: PluginOption = {
  name: "admin-trailing-slash-redirect",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === "/admin") {
        res.writeHead(301, { Location: "/admin/" });
        res.end();
        return;
      }
      next();
    });
  },
};

export default defineConfig({
  plugins: [react(), adminTrailingSlashRedirect],
  build: {
    outDir: "dist/public",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:8301",
      "/admin": { target: "http://localhost:5174", ws: true },
    },
  },
});
