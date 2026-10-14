import { env } from "cloudflare:workers";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb, authSchema, newEntityId, type Entity } from "@lib/db-models";

type AuthEnv = {
  BETTER_AUTH_SECRET: string;
  FRONTEND_CANONICAL_BASE_URL: string;
  AUTH_ALLOWED_HOSTS?: string;
};

let cached: ReturnType<typeof betterAuth> | null = null;

// The origin a request arrived on wins over the configured one, so a single
// deployed version can serve its preview URL and any promoted/custom domain.
// Only allowlisted hosts are honoured; an unknown host falls back to the
// canonical frontend URL.
function allowedHosts(baseUrl: string, configured?: string): string[] {
  const extra = (configured ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
  return [...new Set([new URL(baseUrl).host, ...extra])];
}

const AUTH_MODEL_ENTITIES: Record<string, Entity> = {
  user: "USER",
  session: "USER_SESSION",
  account: "USER_ACCOUNT",
  verification: "USER_VERIFICATION",
};

function generateAuthId({ model }: { model: string }): string {
  const entity = AUTH_MODEL_ENTITIES[model];
  if (!entity) {
    throw new Error(`No entity id prefix for better-auth model "${model}"`);
  }
  return newEntityId(entity);
}

function buildOptions(): BetterAuthOptions {
  const {
    BETTER_AUTH_SECRET,
    FRONTEND_CANONICAL_BASE_URL,
    AUTH_ALLOWED_HOSTS,
  } = env as unknown as AuthEnv;
  return {
    secret: BETTER_AUTH_SECRET,
    baseURL: {
      allowedHosts: allowedHosts(
        FRONTEND_CANONICAL_BASE_URL,
        AUTH_ALLOWED_HOSTS,
      ),
      fallback: FRONTEND_CANONICAL_BASE_URL,
    },
    database: drizzleAdapter(getDb(), {
      provider: "sqlite",
      schema: authSchema,
    }),
    session: { modelName: "user_sessions" },
    account: { modelName: "user_accounts" },
    verification: { modelName: "user_verifications" },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
    },
    advanced: {
      database: { generateId: generateAuthId },
    },
  };
}

export function getAuth(): ReturnType<typeof betterAuth> {
  if (!cached) {
    cached = betterAuth(buildOptions());
  }
  return cached;
}

export type Auth = ReturnType<typeof getAuth>;
