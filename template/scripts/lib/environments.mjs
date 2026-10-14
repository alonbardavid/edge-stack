// Deploy-target host configuration lives here so canonical URLs and every
// domain an uploaded version may answer on are reviewable in one place. Add
// custom domains to the appropriate host list; use hostnames only (no scheme).

const PRODUCTION_HOSTS = [
  "REPLACE_WITH_PROD_URL",
  // "www.example.com",
];

const STAGING_HOSTS = [
  // "staging.example.com",
  // "admin.staging.example.com",
];

// A leading bare wildcard covers the staging Worker's default workers.dev URL
// as well as every alias-prefixed preview URL uploaded to the same Worker.
const STAGING_WORKERS_DEV = "*project-name-staging.*.workers.dev";

export const ENVIRONMENTS = {
  production: {
    workerName: "project-name",
    canonicalBaseUrl: "https://REPLACE_WITH_PROD_URL",
    allowedHosts: PRODUCTION_HOSTS,
    outFile: "wrangler.generated.production.json",
  },
  staging: {
    workerName: "project-name-staging",
    // The account's workers.dev subdomain is resolved by the workflow.
    canonicalBaseUrl: null,
    allowedHosts: [...STAGING_HOSTS, STAGING_WORKERS_DEV],
    outFile: "wrangler.generated.staging.json",
  },
  preview: {
    workerName: "project-name-staging",
    // The branch alias and account subdomain are resolved by the workflow.
    canonicalBaseUrl: null,
    // A preview version may be promoted onto any configured staging domain.
    allowedHosts: [...STAGING_HOSTS],
    outFile: "wrangler.generated.json",
  },
};

export function environmentFor(target) {
  const environment = ENVIRONMENTS[target];
  if (!environment) {
    throw new Error(
      `Unknown deploy target "${target}". Expected one of: ${Object.keys(ENVIRONMENTS).join(", ")}`,
    );
  }
  return environment;
}
