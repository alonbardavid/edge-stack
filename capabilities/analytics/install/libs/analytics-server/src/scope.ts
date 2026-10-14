import { AsyncLocalStorage } from "node:async_hooks";
import { PostHog } from "posthog-node";
import { POSTHOG_HOST, POSTHOG_PROJECT_TOKEN } from "@lib/contract";
import { moduleLogger } from "@lib/logging";
import type { CaptureInput, IdentifyInput } from "./types";

const log = moduleLogger("analytics-server/scope");

type Emission =
  | ({ kind: "capture" } & CaptureInput)
  | ({ kind: "identify" } & IdentifyInput);

type ScopeConfig = {
  /** Off, every event is logged instead of sent. */
  deliver: boolean;
};

type Collector = {
  config: ScopeConfig;
  queued: Emission[];
  ended: boolean;
  waitUntil: (work: Promise<unknown>) => void;
};

const requestAnalytics = new AsyncLocalStorage<Collector>();

/**
 * Runs `run` in a scope that buffers every event it emits, then sends them as
 * one batch through `waitUntil`, so tracking never delays the response.
 */
export async function withAnalytics<T>(
  config: ScopeConfig,
  run: () => Promise<T>,
  waitUntil: (work: Promise<unknown>) => void,
): Promise<T> {
  const collector: Collector = { config, queued: [], ended: false, waitUntil };
  try {
    return await requestAnalytics.run(collector, run);
  } finally {
    collector.ended = true;
    scheduleFlush(collector);
  }
}

/** Shaped like posthog-node's client, whose calls it buffers. */
export const analytics = {
  capture(input: CaptureInput): void {
    enqueue({ kind: "capture", ...input });
  },
  identify(input: IdentifyInput): void {
    enqueue({ kind: "identify", ...input });
  },
};

function enqueue(emission: Emission): void {
  const collector = requestAnalytics.getStore();
  if (!collector) {
    log.warn("event emitted outside a withAnalytics scope, dropped", {
      event: describe(emission),
    });
    return;
  }
  collector.queued.push(emission);
  // Work the request left running (its own waitUntil) can still emit.
  if (collector.ended) {
    scheduleFlush(collector);
  }
}

function scheduleFlush(collector: Collector): void {
  const queued = collector.queued.splice(0);
  if (queued.length === 0) {
    return;
  }
  collector.waitUntil(
    collector.config.deliver ? deliver(queued) : logEmissions(queued),
  );
}

async function deliver(emissions: Emission[]): Promise<void> {
  // Built per batch: a Worker may not carry I/O objects across requests.
  const client = new PostHog(POSTHOG_PROJECT_TOKEN, {
    host: POSTHOG_HOST,
    flushAt: emissions.length,
    flushInterval: 0,
  });
  try {
    emissions.forEach((emission) => send(client, emission));
    await client.shutdown();
    log.info("delivered events to PostHog", { count: emissions.length });
  } catch (err) {
    log.error("failed to deliver events to PostHog", { err });
  }
}

// Identify traits hold emails and names, so only their keys are logged.
async function logEmissions(emissions: Emission[]): Promise<void> {
  for (const emission of emissions) {
    log.info("analytics event", {
      event: describe(emission),
      distinctId: emission.distinctId,
      ...(emission.kind === "capture"
        ? { properties: JSON.stringify(emission.properties ?? {}) }
        : { traits: Object.keys(emission.properties).join(",") }),
    });
  }
}

function send(client: PostHog, emission: Emission): void {
  switch (emission.kind) {
    case "capture":
      return client.capture({
        distinctId: emission.distinctId,
        event: emission.event,
        properties: { ...emission.properties, app_side: "server" },
      });
    case "identify":
      return client.identify({
        distinctId: emission.distinctId,
        properties: emission.properties,
      });
  }
}

function describe(emission: Emission): string {
  return emission.kind === "capture" ? emission.event : "$identify";
}
