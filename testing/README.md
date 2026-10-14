# Testing edge-stack on Cloudflare (cloud sessions)

How to prove, from a Claude Code cloud session, that `create-edge-stack` produces an app that
builds, deploys, and runs on Cloudflare. The deploy goes to a **preview alias of the
`alonbd-skills-test` Worker** with its own throwaway D1 — the Worker's live deployment is never
touched.

The `bash` blocks below share variables, so run them as **one script** (Claude's Bash tool does
not keep shell state between calls). From the repo root:

```
awk '/^```bash$/{f=1;next} /^```$/{f=0} f' testing/README.md > "$WORK/cf-test.sh"   # any scratch path
bash "$WORK/cf-test.sh"
```

It stops at the first failure and deletes the preview D1 on exit either way (set `KEEP_DB=1` to
keep it for manual poking, then clean up with step 7). Override `WORK` / `ALIAS` via env vars.

## Guardrails

- **Only upload versions with `--preview-alias`.** Never run `wrangler deploy`,
  `wrangler versions deploy`, or `wrangler secret put` (it creates *and deploys* a version) against
  `alonbd-skills-test`. Its live deployment stays the placeholder "Hello World!".
- **Stay in your lane.** The token can see other projects' Workers and D1 databases in the same
  account (`vixy-*`, `bd-home-*`, `amadeus-*`, …). Only touch the `alonbd-skills-test` Worker and
  D1 databases named `alonbd-skills-test-preview-*`.
- **Always delete the D1 you created** (step 7), even when an earlier step failed.

## Prerequisites (cloud environment settings)

- **`CLOUDFLARE_API_TOKEN`** env var — wrangler reads it directly. An account API token that sees
  exactly one account, with:
  - *Workers Scripts: Edit* (account level) — upload versions, and read the account's
    `workers.dev` subdomain. The subdomain lookup is account-level: a token scoped to only the
    `alonbd-skills-test` script can upload but fails on it.
  - *D1: Edit* — create, migrate, query, delete the preview D1.
- **`WRANGLER_SEND_METRICS=false`** — wrangler's telemetry host (`sparrow.cloudflare.com`) is
  blocked by the session proxy, which makes some commands (e.g. `d1 info --json`) hang for
  minutes. Set it in the environment, or rely on the `export` in step 1.
- **Network access** must allow `*.alonbd.workers.dev` for the smoke tests (step 6). Everything
  else goes to `api.cloudflare.com` and the npm registry.
- **Preview URLs enabled on the Worker** — a one-time setting, already on. If an upload prints no
  `Version Preview Alias URL`, turn it back on:
  `curl -X POST -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H 'Content-Type: application/json' -d '{"enabled":true,"previews_enabled":true}' "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/scripts/alonbd-skills-test/subdomain"`

## 1. Variables

```bash
set -euo pipefail
export WRANGLER_SEND_METRICS=false
REPO=$(git rev-parse --show-toplevel)       # this repo, on the branch under test
WORK=${WORK:-$(mktemp -d)}                  # in a cloud session, point this at your scratchpad
SLUG=alonbd-skills-test
SNAKE=alonbd_skills_test
WORKER=alonbd-skills-test
ALIAS=${ALIAS:-t-$(date +%m%d%H%M)}         # lowercase letters/digits/dashes, starts with a letter, <= 44 chars
DB_NAME=$SLUG-preview-$ALIAS
APP=$WORK/$SLUG
CF_API=https://api.cloudflare.com/client/v4
AUTH=(-H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
echo "alias=$ALIAS db=$DB_NAME app=$APP"

DB_CREATED=
cleanup() {
  if [ -n "$DB_CREATED" ] && [ -z "${KEEP_DB:-}" ]; then
    (cd "$APP/apps/backend" && pnpm exec wrangler d1 delete "$DB_NAME" -y)
  fi
}
trap cleanup EXIT
```

## 2. Scaffold, exactly as `create-edge-stack` §2–3 does

```bash
test ! -e "$APP" || { echo "$APP already exists"; exit 1; }
mkdir -p "$APP" && cp -R "$REPO/template/." "$APP/" && cd "$APP"
TODAY=$(date +%F)
grep -rIl -e "project-name" -e "project_name" -e "REPLACE_WITH_TODAY" . \
  | xargs sed -i -e "s/project-name/$SLUG/g" -e "s/project_name/$SNAKE/g" \
      -e "s/REPLACE_WITH_TODAY/$TODAY/g"
find . -name "*REPLACE_WITH_TODAY*" | while read -r f; do mv "$f" "${f//REPLACE_WITH_TODAY/$TODAY}"; done
if grep -rIn -e "project-name" -e "project_name" -e "REPLACE_WITH_TODAY" .; then
  echo "placeholders left after scaffolding"; false
fi
git init -q                                  # husky's `prepare` wants a git repo
```

## 3. Local checks

```bash
cd "$APP"
pnpm install --frozen-lockfile
pnpm type-check
pnpm lint
pnpm build
```

E2E. The session's pre-installed Chromium (`/opt/pw-browsers`) can be an older revision than the
template's `@playwright/test` expects, and `playwright install` must not be run in cloud
sessions — so alias the installed headless shell under the expected revision:

```bash
cd "$APP/tests"
REV=$(node -e "const p=require('path');const pc=require.resolve('playwright-core/package.json',{paths:[p.dirname(require.resolve('@playwright/test/package.json'))]});console.log(require(p.join(p.dirname(pc),'browsers.json')).browsers.find(b=>b.name==='chromium-headless-shell').revision)")
if [ ! -d "/opt/pw-browsers/chromium_headless_shell-$REV" ]; then
  HAVE=$(ls -d /opt/pw-browsers/chromium_headless_shell-* | head -n1)
  SHIM=$WORK/pw-browsers
  DIR=$SHIM/chromium_headless_shell-$REV/chrome-headless-shell-linux64
  mkdir -p "$DIR"
  ln -sf "$HAVE"/chrome-linux/* "$DIR/"
  ln -sf "$HAVE/chrome-linux/headless_shell" "$DIR/chrome-headless-shell"
  touch "$SHIM/chromium_headless_shell-$REV/INSTALLATION_COMPLETE"
  export PLAYWRIGHT_BROWSERS_PATH=$SHIM
fi
cd "$APP" && CI=1 pnpm test --reporter=line
```

## 4. Resolve the account and create the preview D1

Mirrors `.github/actions/cloudflare-env` and the "Find or create preview D1" step of
`preview-deploy.yml`.

```bash
cd "$APP/apps/backend"
ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID:-$(curl -fsS "${AUTH[@]}" "$CF_API/accounts" | jq -r '.result[0].id')}
SUBDOMAIN=$(curl -fsS "${AUTH[@]}" "$CF_API/accounts/$ACCOUNT_ID/workers/subdomain" | jq -r '.result.subdomain')
ORIGIN=https://$ALIAS-$WORKER.$SUBDOMAIN.workers.dev
echo "account=$ACCOUNT_ID origin=$ORIGIN"
pnpm exec wrangler d1 create "$DB_NAME"
DB_CREATED=1
DB_ID=$(curl -fsS "${AUTH[@]}" "$CF_API/accounts/$ACCOUNT_ID/d1/database?name=$DB_NAME" \
  | jq -r ".result[] | select(.name == \"$DB_NAME\") | .uuid")
test -n "$DB_ID"
```

## 5. Generate the preview config, migrate, upload under the alias

The template's `preview` target names the Worker `<slug>-staging` and expects
`BETTER_AUTH_SECRET` as a Worker secret. For this test we retarget the generated config to
`alonbd-skills-test` and put a throwaway secret in `vars` — setting a real secret would deploy a
new live version.

```bash
cd "$APP"
TARGET=preview DB_NAME=$DB_NAME DB_ID=$DB_ID DEPLOY_ORIGIN=$ORIGIN node scripts/gen-wrangler-config.mjs
cd apps/backend
jq --arg name "$WORKER" --arg secret "$(openssl rand -hex 32)" \
  '.name = $name | .vars.BETTER_AUTH_SECRET = $secret' \
  wrangler.generated.json > wrangler.tmp.json && mv wrangler.tmp.json wrangler.generated.json
pnpm exec wrangler d1 migrations apply DB --config wrangler.generated.json --remote
SKIP_WRANGLER_BUILD=1 pnpm exec wrangler versions upload --config wrangler.generated.json \
  --preview-alias "$ALIAS" --message "edge-stack test $ALIAS" | tee "$WORK/upload.log"
grep -q "Version Preview Alias URL: $ORIGIN" "$WORK/upload.log"
```

## 6. Smoke test the preview

Creates an admin in the preview D1, then walks the real flows: admin login → create end-user →
end-user sign-in/session → admin API refused to the end-user. Allow a few seconds after the
upload for the alias to propagate.

```bash
cd "$APP"
ADMIN_PW=$(openssl rand -hex 12)
node scripts/create-admin.mjs --username admin --password "$ADMIN_PW" --db-name "$DB_NAME"
U=$ORIGIN
J=(-H "Content-Type: application/json" -H "Origin: $U")
JAR=$WORK/cookies && mkdir -p "$JAR"
EMAIL=smoke_$(date +%s)@example.com
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
for _ in $(seq 1 12); do [ "$(code "$U/api/health")" = 200 ] && break; sleep 5; done

curl -fsS "$U/api/health" | jq -e '.status == "ok" and .checks.database.status == "ok"'
test "$(code "$U/")" = 200
test "$(code "$U/admin")" = 200
curl -fsS -c "$JAR/admin" "${J[@]}" -d "{\"username\":\"admin\",\"password\":\"$ADMIN_PW\"}" \
  "$U/api/admin/auth/login" | jq -e '.username == "admin"'
curl -fsS -b "$JAR/admin" "${J[@]}" -d "{\"email\":\"$EMAIL\",\"name\":\"Smoke\",\"password\":\"smoke-pass-123\"}" \
  "$U/api/admin/users" | jq -e '.emailVerified == true'
test "$(code "${J[@]}" -d "{\"email\":\"$EMAIL\",\"password\":\"wrong-pass-000\"}" "$U/api/auth/sign-in/email")" = 401
test "$(code -c "$JAR/user" "${J[@]}" -d "{\"email\":\"$EMAIL\",\"password\":\"smoke-pass-123\"}" "$U/api/auth/sign-in/email")" = 200
curl -fsS -b "$JAR/user" "$U/api/auth/get-session" | jq -e --arg e "$EMAIL" '.user.email == $e'
test "$(code -b "$JAR/user" "$U/api/admin/users")" = 401
curl -fsS "https://$WORKER.$SUBDOMAIN.workers.dev/"; echo   # live deployment untouched: "Hello World!"
echo "SMOKE OK: $U"
```

## 7. Clean up

The `trap` from step 1 deletes the preview D1 when the script exits. If you ran with `KEEP_DB=1`,
or a session died mid-run, delete it by hand and check nothing is left over:

```
pnpm --dir "$APP/apps/backend" exec wrangler d1 delete "$DB_NAME" -y
curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/d1/database?name=alonbd-skills-test-preview" \
  | jq -r '.result[].name'                                   # expect no output
```

The uploaded version stays in the Worker's version history — it is never deployed, and its alias
URL just errors once the D1 is gone. Re-uploading with the same `ALIAS` repoints the alias.

## What this does not cover

- The GitHub Actions workflows themselves (it runs their steps by hand, minus the staging-D1
  clone: the preview D1 here is freshly migrated, not seeded from `<slug>-staging`).
- Staging and production targets, custom domains, and capabilities added by
  `add-edge-capability`.
