import { expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface BrowserEvent {
  event: string;
  distinctId: string;
  properties: Record<string, unknown>;
  raw: string;
}

const PREFIX = "[analytics] ";
const WORKER_LOG = resolve(import.meta.dirname, "../../.logs/worker.log");

/** Outside production the browser logs every event instead of sending it. */
export function captureBrowserEvents(page: Page): BrowserEvent[] {
  const events: BrowserEvent[] = [];
  page.on("console", (message) => {
    const event = parseConsoleLine(message.text());
    if (event) {
      events.push(event);
    }
  });
  return events;
}

export async function waitForBrowserEvent(
  events: BrowserEvent[],
  match: (event: BrowserEvent) => boolean,
): Promise<BrowserEvent> {
  await expect.poll(() => events.some(match), { timeout: 15000 }).toBe(true);
  return events.find(match)!;
}

/** The worker logs an "analytics event" line per event it would have sent. */
export async function waitForWorkerEvent(
  event: string,
  distinctId: string,
): Promise<Record<string, string>> {
  let found: Record<string, string> | undefined;
  await expect
    .poll(
      async () => {
        found = (await readWorkerLog())
          .map(parseLogfmt)
          .find(
            (line) =>
              line.msg === "analytics event" &&
              line.event === event &&
              line.distinctId === distinctId,
          );
        return found !== undefined;
      },
      { timeout: 15000, message: `the worker logged no ${event} event` },
    )
    .toBe(true);
  return found!;
}

function parseConsoleLine(text: string): BrowserEvent | null {
  if (!text.startsWith(PREFIX)) {
    return null;
  }
  const body = text.slice(PREFIX.length);
  const separator = body.indexOf(" ");
  try {
    const payload = JSON.parse(body.slice(separator + 1)) as {
      distinct_id: string;
      properties: Record<string, unknown>;
    };
    return {
      event: body.slice(0, separator),
      distinctId: payload.distinct_id,
      properties: payload.properties,
      raw: text,
    };
  } catch {
    return null;
  }
}

async function readWorkerLog(): Promise<string[]> {
  try {
    return (await readFile(WORKER_LOG, "utf8")).split("\n");
  } catch {
    throw new Error(
      `${WORKER_LOG} is missing. The backend dev server started by this suite ` +
        `writes it; a server already running is reused and does not, so stop it first.`,
    );
  }
}

function parseLogfmt(line: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [, key, quoted, bare] of line.matchAll(
    /(\w+)=(?:"((?:[^"\\]|\\.)*)"|(\S+))/g,
  )) {
    fields[key] = quoted === undefined ? bare : quoted.replace(/\\(.)/g, "$1");
  }
  return fields;
}
