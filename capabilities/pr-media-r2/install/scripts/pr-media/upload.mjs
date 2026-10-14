#!/usr/bin/env node
// Uploads PR screenshots/videos to the `project-name-pr-media` R2 bucket under a
// random-UUID key and prints ready-to-paste markdown for the PR body.
//
// Usage: node scripts/pr-media/upload.mjs <file...>
//
// Reads are public: anything in the bucket is served from its r2.dev URL, so the
// random-UUID keys are all that keep links unguessable. The bucket expires
// objects after 30 days.
//
// With CLOUDFLARE_API_TOKEN set, requests are signed for R2's S3 endpoint
// directly: a token scoped to one bucket only authorizes the S3 API, so it
// cannot drive `wrangler r2 object put`. Without it, wrangler is used with its
// `wrangler login` session.
/* global fetch */
import { spawnSync } from "node:child_process";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const DEFAULT_BASE_URL = "REPLACE_WITH_PR_MEDIA_URL";
const BUCKET = "project-name-pr-media";
const REGION = "auto";
const SERVICE = "s3";

const CONTENT_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};
// GitHub has no inline player for video hosted outside github.com.
const VIDEO_TYPES = new Set([".mp4", ".mov", ".webm"]);

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const hmac = (key, data) => createHmac("sha256", key).update(data).digest();

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function cloudflareApi(path, token) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => null);
  return response.ok && body?.success
    ? { result: body.result }
    : { error: body?.errors?.[0]?.message ?? `HTTP ${response.status}` };
}

// A token scoped to one bucket cannot list accounts, so it needs
// CLOUDFLARE_ACCOUNT_ID.
async function resolveAccountId(token) {
  if (process.env.CLOUDFLARE_ACCOUNT_ID) return process.env.CLOUDFLARE_ACCOUNT_ID;
  const { result, error } = await cloudflareApi("accounts", token);
  if (result?.length === 1) return result[0].id;
  fail(
    `Could not derive the Cloudflare account from CLOUDFLARE_API_TOKEN (${error ?? `it sees ${result?.length ?? 0} accounts`}). Set CLOUDFLARE_ACCOUNT_ID.`,
  );
}

// R2 derives the S3 credential pair from an API token: the access key id is the
// token's id and the secret is the SHA-256 of its value. Account-owned and
// user-owned tokens are verified at different endpoints.
async function resolveCredentials(accountId, token) {
  let verified = await cloudflareApi(`accounts/${accountId}/tokens/verify`, token);
  if (!verified.result) {
    verified = await cloudflareApi("user/tokens/verify", token);
  }
  if (!verified.result) {
    fail(
      `CLOUDFLARE_API_TOKEN was rejected by Cloudflare (${verified.error}). It needs R2 object write access to the ${BUCKET} bucket.`,
    );
  }
  return { accessKeyId: verified.result.id, secretAccessKey: sha256(token) };
}

function signedRequest({ accountId, credentials, key, body, contentType }) {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const canonicalUri = `/${BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const payloadHash = sha256(body);

  const headers = {
    "content-type": contentType,
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const signedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaders
    .map((name) => `${name}:${headers[name]}\n`)
    .join("");
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders.join(";"),
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256(canonicalRequest),
  ].join("\n");

  let signingKey = hmac(`AWS4${credentials.secretAccessKey}`, dateStamp);
  for (const part of [REGION, SERVICE, "aws4_request"]) {
    signingKey = hmac(signingKey, part);
  }
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");

  headers.Authorization =
    `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders.join(";")}, Signature=${signature}`;
  return { url: `https://${host}${canonicalUri}`, headers };
}

// Without credentials of its own, wrangler exits non-zero — and in a
// non-interactive shell it fails rather than opening a browser — so this never
// blocks on a prompt.
function putViaWrangler({ key, path, contentType }) {
  const { error, status } = spawnSync(
    "pnpm",
    [
      "--filter",
      "@app/backend",
      "exec",
      "wrangler",
      "r2",
      "object",
      "put",
      `${BUCKET}/${key}`,
      "--file",
      path,
      "--content-type",
      contentType,
      "--remote",
    ],
    {
      cwd: REPO_ROOT,
      stdio: ["ignore", "inherit", "inherit"],
      // The first-run telemetry prompt would block an interactive shell.
      env: { WRANGLER_SEND_METRICS: "false", ...process.env },
    },
  );
  if (error) {
    fail(`Could not run wrangler: ${error.message}`);
  }
  if (status !== 0) {
    fail(`wrangler could not upload ${basename(path)} (see the error above).`);
  }
}

const baseUrl = (process.env.PR_MEDIA_BASE_URL ?? DEFAULT_BASE_URL).replace(
  /\/$/,
  "",
);
if (!baseUrl.startsWith("https://")) {
  fail(
    `The bucket's public URL is not configured. Enable it with \`wrangler r2 bucket dev-url enable ${BUCKET}\`, then set DEFAULT_BASE_URL in this script or the PR_MEDIA_BASE_URL env var.`,
  );
}

const files = process.argv.slice(2);
if (files.length === 0) {
  fail("Usage: node scripts/pr-media/upload.mjs <file...>");
}

const token = process.env.CLOUDFLARE_API_TOKEN;

// Validated up front so a typo in the last argument doesn't leave half the
// batch uploaded.
const uploads = files.map((file) => {
  const path = resolve(file);
  if (!existsSync(path)) {
    fail(`No such file: ${file}`);
  }
  const ext = extname(path).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    fail(
      `Unsupported file type "${ext}" (${file}). Supported: ${Object.keys(CONTENT_TYPES).join(", ")}`,
    );
  }
  return { path, ext, contentType, key: `${randomUUID()}/${basename(path)}` };
});

let put;
if (token) {
  const accountId = await resolveAccountId(token);
  const credentials = await resolveCredentials(accountId, token);
  put = async ({ key, path, contentType }) => {
    const body = readFileSync(path);
    const { url, headers } = signedRequest({
      accountId,
      credentials,
      key,
      body,
      contentType,
    });
    const response = await fetch(url, { method: "PUT", headers, body });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      fail(
        `Upload failed for ${basename(path)} (HTTP ${response.status}). ${detail.slice(0, 300)}`,
      );
    }
  };
} else {
  console.log(
    "CLOUDFLARE_API_TOKEN is not set — uploading with wrangler.\n",
  );
  put = putViaWrangler;
}

const markdown = [];
for (const upload of uploads) {
  await put(upload);
  console.log(`Uploaded ${basename(upload.path)} → ${upload.key}`);
  const publicUrl = `${baseUrl}/${upload.key}`;
  markdown.push(
    VIDEO_TYPES.has(upload.ext)
      ? publicUrl
      : `![${basename(upload.path)}](${publicUrl})`,
  );
}

console.log("\nPaste into the PR body:\n");
console.log(markdown.join("\n\n"));
