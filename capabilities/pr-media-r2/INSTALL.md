# Install: `pr-media-r2`

> This file is the **install contract** that `add-edge-capability` executes, top to bottom.
> `install/` holds the **new** files; `install-patches/` holds one **git patch per existing
> project file** the capability modifies.

Moves PR screenshots and videos from GitHub attachments to an R2 bucket, and restores the
image markdown that Claude Code cloud sessions strip. `README.md` summarises it; the installed
`docs/pr-media.md` is the project-side reference.

## Before you install

Offer this to a user who works on the project from Claude Code on the web (cloud sessions).
Locally, base's GitHub attachments are the better default: no infrastructure, and the media
follows the repository's own access control. Say so, and that this bucket is public-read:
links are unguessable, not private.

## Steps

### 1. Apply

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/add-edge-capability/apply-capability.mjs" \
  "${CLAUDE_PLUGIN_ROOT}/capabilities/pr-media-r2"
```

New files:

```
scripts/pr-media/upload.mjs                 # uploads to R2, prints the markdown
.github/workflows/restore-image-embeds.yml  # restores "![…]" on R2 image links in PRs
docs/pr-media.md                            # the project's PR-media reference
```

| Patch | What it does |
| --- | --- |
| `CLAUDE.md` | the screenshots rule uploads with the script, and says the bucket is world-readable |
| `README.md` | links `docs/pr-media.md` from the docs index |

`upload.mjs` carries the placeholder `REPLACE_WITH_PR_MEDIA_URL` (the bucket's public URL)
until step 3. If the user already knows it, pass `--set REPLACE_WITH_PR_MEDIA_URL=https://pub-….r2.dev`.

### 2. Record the version

Add `"pr-media-r2": "<version from capability.json>"` to `capabilities` in
`.edge-stack.json`.

### 3. Set up R2 (walk the user through it)

Run these with the user's own Cloudflare credentials (suggest `! wrangler login`) — creating
the bucket and enabling public access need account-level R2 rights:

```bash
pnpm --filter @app/backend exec wrangler r2 bucket create <slug>-pr-media
pnpm --filter @app/backend exec wrangler r2 bucket lifecycle add <slug>-pr-media expire-30d --expire-days 30 -y
pnpm --filter @app/backend exec wrangler r2 bucket dev-url enable <slug>-pr-media
```

The last one prints the bucket's public URL (`https://pub-<hash>.r2.dev`); replace
`REPLACE_WITH_PR_MEDIA_URL` in `scripts/pr-media/upload.mjs` with it.

The script reads `CLOUDFLARE_API_TOKEN`, the variable wrangler reads too. Any Cloudflare API
token with R2 object write access to the bucket works (an account token with **Workers R2
Storage: Edit**, for instance); the script derives R2's S3 credentials from it. It finds the
account from the token, or from `CLOUDFLARE_ACCOUNT_ID` when the token sees more than one
account or cannot list them. With no token set, it uploads through `wrangler r2 object put`
on the `wrangler login` session, so a developer logged in to wrangler locally needs nothing.

For cloud sessions, the user sets `CLOUDFLARE_API_TOKEN` as an environment variable in the
Claude environment's settings, and allows `api.cloudflare.com` and
`<account id>.r2.cloudflarestorage.com` in its network policy (settings apply to sessions
started afterwards). The narrowest token is one scoped to the bucket — **R2 → API → Manage API
tokens → Create API token**, **Object Read & Write**, **Apply to specific buckets** →
`<slug>-pr-media` — plus `CLOUDFLARE_ACCOUNT_ID`, since such a token cannot list accounts.
Only use it where nothing else needs `CLOUDFLARE_API_TOKEN`: wrangler can do nothing with it.
No GitHub secret is involved: the restore workflow uses the built-in `GITHUB_TOKEN`.

### 4. Verify

```bash
pnpm install
pnpm type-check
pnpm lint
pnpm build
pnpm test
```

Once step 3 is done, `node scripts/pr-media/upload.mjs <some.png>` uploads the file and
prints markdown whose URL opens in a browser. The workflow first runs after it reaches the
default branch: `issue_comment` workflows execute from there.
