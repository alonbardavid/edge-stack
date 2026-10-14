import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { API, loginAsAdmin } from "../admin/helpers";

const WORKER_LOG = resolve(import.meta.dirname, "../../.logs/worker.log");

// The rest of the suite asserts behaviour, so it stays green when a request
// silently stops carrying its id, route or caller in the log.
test.describe("Request logs", () => {
  test("a request's lines carry its module, id, route and admin", async ({
    request,
  }) => {
    await loginAsAdmin(request);

    const created = await request.post(`${API}/api/admin/users`, {
      data: {
        email: `log_${Date.now()}@example.com`,
        name: "Log Spec",
        password: "log-spec-pass-123",
      },
    });
    expect(created.status()).toBe(200);
    const { id: userId } = await created.json();

    const requestId = created.headers()["x-request-id"];
    expect(requestId, "the response should carry a request id").toBeTruthy();

    const lines = await linesFor(requestId);

    const createdLine = lines.find(
      (line) =>
        line.msg === "user created" &&
        line.logger === "admin-api.users.service",
    );
    expect(
      createdLine,
      `no "user created" line for ${requestId}`,
    ).toBeDefined();
    expect(createdLine).toMatchObject({
      level: "info",
      method: "POST",
      path: "/api/admin/users",
      adminUsername: "testadmin",
      userId,
    });
    expect(createdLine?.adminId).toBeTruthy();

    const requestLine = lines.find((line) => line.logger === "hono");
    expect(requestLine, `no request line for ${requestId}`).toBeDefined();
    expect(requestLine).toMatchObject({
      method: "POST",
      path: "/api/admin/users",
      status: "200",
    });
  });
});

type Line = Record<string, string>;

async function linesFor(requestId: string): Promise<Line[]> {
  let found: Line[] = [];
  await expect
    .poll(
      async () => {
        found = (await readLog())
          .map(parseLogfmt)
          .filter((line) => line.requestId === requestId);
        return found.length;
      },
      { timeout: 15000, message: `no log lines for request ${requestId}` },
    )
    .toBeGreaterThan(0);
  return found;
}

async function readLog(): Promise<string[]> {
  try {
    return (await readFile(WORKER_LOG, "utf8")).split("\n");
  } catch {
    throw new Error(
      `${WORKER_LOG} is missing. The backend dev server started by this suite ` +
        `writes it; a server already running is reused and does not, so stop it first.`,
    );
  }
}

function parseLogfmt(line: string): Line {
  const fields: Line = {};
  for (const [, key, quoted, bare] of line.matchAll(
    /(\w+)=(?:"((?:[^"\\]|\\.)*)"|(\S+))/g,
  )) {
    fields[key] = quoted === undefined ? bare : quoted.replace(/\\(.)/g, "$1");
  }
  return fields;
}
