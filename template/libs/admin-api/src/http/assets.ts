import { env } from "cloudflare:workers";
import type { Context } from "hono";

export function serveAdminApp(c: Context): Promise<Response> {
  const url = new URL(c.req.url);
  const isFileRequest = /\.[a-z0-9]+$/i.test(url.pathname);
  if (isFileRequest) {
    return assets().fetch(c.req.raw);
  }
  return assets().fetch(new Request(new URL("/admin/index.html", url.origin)));
}

function assets(): Fetcher {
  return (env as unknown as { ASSETS: Fetcher }).ASSETS;
}
