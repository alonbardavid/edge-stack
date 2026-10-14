import { env } from "cloudflare:workers";
import { POSTHOG_HOST } from "@lib/contract";
import { moduleLogger } from "@lib/logging";
import { analyticsDeliveryEnabled } from "./environment";

const log = moduleLogger("analytics-server/persons");

type ErasureEnv = {
  POSTHOG_PROJECT_ID?: string;
  POSTHOG_PERSONAL_API_KEY?: string;
  ENVIRONMENT?: string;
  NODE_ENV?: string;
};

/** There may be a profile to erase, but no key to erase it with. */
export class PersonErasureNotConfiguredError extends Error {
  constructor() {
    super(
      "PostHog erasure is not configured: set the POSTHOG_PROJECT_ID and POSTHOG_PERSONAL_API_KEY secrets",
    );
  }
}

/**
 * Erases the PostHog person behind a distinct id together with their events —
 * the analytics half of the right to be forgotten. Without a key it only
 * passes where nothing can have been delivered; anywhere else it throws rather
 * than let the caller claim an erasure that did not happen.
 */
export async function erasePerson(
  distinctId: string,
): Promise<"erased" | "nothing-delivered"> {
  const { POSTHOG_PROJECT_ID, POSTHOG_PERSONAL_API_KEY } =
    env as unknown as ErasureEnv;
  if (!POSTHOG_PROJECT_ID || !POSTHOG_PERSONAL_API_KEY) {
    if (mayHaveDelivered()) {
      throw new PersonErasureNotConfiguredError();
    }
    log.info("analytics are not delivered here, no profile to erase", {
      distinctId,
    });
    return "nothing-delivered";
  }
  const persons = `${privateApiHost()}/api/projects/${encodeURIComponent(POSTHOG_PROJECT_ID)}/persons/`;
  const headers = { Authorization: `Bearer ${POSTHOG_PERSONAL_API_KEY}` };

  const found = await fetch(
    `${persons}?distinct_id=${encodeURIComponent(distinctId)}`,
    { headers },
  );
  if (!found.ok) {
    throw new Error(`PostHog persons lookup failed (${found.status})`);
  }
  const { results = [] } = (await found.json()) as {
    results?: { id: string }[];
  };
  for (const person of results) {
    const deleted = await fetch(
      `${persons}${encodeURIComponent(person.id)}/?delete_events=true`,
      { method: "DELETE", headers },
    );
    if (!deleted.ok && deleted.status !== 404) {
      throw new Error(`PostHog person deletion failed (${deleted.status})`);
    }
  }
  log.info("erased PostHog persons", { distinctId, count: results.length });
  return "erased";
}

// A deployed Worker that was never told its ENVIRONMENT (one that serves no
// analytics of its own) cannot rule out that its users' events were sent.
function mayHaveDelivered(): boolean {
  const { ENVIRONMENT, NODE_ENV } = env as unknown as ErasureEnv;
  return (
    analyticsDeliveryEnabled() || (NODE_ENV === "production" && !ENVIRONMENT)
  );
}

// The private API sits beside the ingestion host: us.i.posthog.com is served
// by us.posthog.com. A self-hosted instance serves both from one host.
function privateApiHost(): string {
  return POSTHOG_HOST.replace(".i.posthog.com", ".posthog.com");
}
