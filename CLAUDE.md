# edge-stack — maintainer guide

The `edge-stack` Claude Code plugin. This file is the contract for adding to it. Read it before
changing structure, adding capabilities, or writing patches.

## What this repo is

The repo root **is the plugin** (`.claude-plugin/plugin.json`), and also its own one-plugin
marketplace (`.claude-plugin/marketplace.json`, both named `edge-stack`, plugin `source: "./"`),
so users install it with `/plugin marketplace add alonbardavid/edge-stack` then
`/plugin install edge-stack@edge-stack`. It bundles **three skills** plus a shared project
template, a capability registry and per-capability upgrade patches. Skills are invoked
**explicitly** (the user does not want auto-discovery) — descriptions are scoped to "when the
user asks to…". Plugin skills are namespaced: `/edge-stack:create-edge-stack`.

```
.claude-plugin/plugin.json          # plugin manifest
.claude-plugin/marketplace.json     # one-plugin marketplace, source "./" (the repo root)
skills/
  create-edge-stack/SKILL.md        # scaffold a new project from template/
  update-edge-stack/SKILL.md        # apply patch chains to upgrade a project
  add-edge-capability/SKILL.md      # add an optional capability to a project
  add-edge-capability/apply-capability.mjs  # copies install/, renders + applies install-patches/
template/                           # the canonical edge-stack project starter (placeholdered)
capabilities/                       # installable capabilities, shared by the skills
  email-sending/   capability.json, README.md, INSTALL.md, install/, install-patches/
  neon-postgres/   capability.json, README.md, INSTALL.md, install/, install-patches/, optional/
  pr-media-r2/     capability.json, README.md, INSTALL.md, install/, install-patches/
  production-hardening/  capability.json, README.md, INSTALL.md, install/, install-patches/,
                         with/neon-postgres/
  analytics/       capability.json, README.md, INSTALL.md, install/, install-patches/
  privacy/         capability.json, README.md, INSTALL.md, install/, install-patches/
patches/                            # version-to-version upgrades, read by update-edge-stack
  <cap>/           <from>__<to>/    (created by the first upgrade step; base included)
testing/README.md                   # deploy-test a scaffolded app on Cloudflare
```

## How it is installed

Claude Code copies the plugin directory — here the **whole repo** — into its install cache
and loads that copy; `${CLAUDE_PLUGIN_ROOT}` points at it. So `template/`, `capabilities/`
and `patches/` are reachable at runtime, and all three skills share them directly. This
`CLAUDE.md` is copied too but is **not** loaded into a user's session (`claude plugin
validate` warns about it): it only guides work on this repo. Anything a skill needs at
runtime goes in a skill or the files it reads.

**Rule: every file a skill reads at runtime must live in this repo.** Reference it via
`${CLAUDE_PLUGIN_ROOT}/...` in SKILL.md (with a fallback to the skill file's grandparent, the
repo root, for running from a clone).

Installed copies are keyed by `plugin.json` `version`: pushing without bumping it leaves users
on the old copy. Before a release, run `claude plugin validate .` and try it with
`claude --plugin-dir .`.

## Placeholder convention

The template is tokenized so `create-edge-stack` can rename it:

- `project-name` → the kebab-case project slug (package name, Worker names, D1 names)
- `project_name` → the snake-case slug (token keys, e.g. `localStorage` keys)

Plus `REPLACE_WITH_PROD_URL` (the production hostname, in `scripts/lib/environments.mjs`) and
`REPLACE_WITH_EMAIL_FROM` (the bare outbound sender address, inserted by the `email-sending`
install into all three deploy workflows and `gen:prod-config` — non-production targets tag it
with an `EMAIL_TAG` at config-generation time rather than carrying a second placeholder),
filled during Cloudflare setup. `REPLACE_WITH_PR_MEDIA_URL` (the PR-media bucket's public
r2.dev URL, in `pr-media-r2`'s `scripts/pr-media/upload.mjs`) is filled during that
capability's R2 setup. `REPLACE_WITH_POSTHOG_HOST` / `REPLACE_WITH_POSTHOG_TOKEN` (the PostHog
ingestion host and public project token, in the `analytics` install's
`libs/contract/src/analytics.ts`) are filled by `--set` at install, or later by hand, as is
`REPLACE_WITH_PRIVACY_EMAIL` (the address data requests go to, in the `privacy` install's
`apps/frontend/src/screens/privacy/content.ts`). And `REPLACE_WITH_TODAY` (a `YYYY-MM-DD`
date, in file contents **and file names**), filled when the file lands in a project — by
`create-edge-stack` for `template/`, by `add-edge-capability` for a capability's
`install/`. It dates the ADRs.
`REPLACE_WITH_NOW` (a `YYYYMMDDHHMMSS` timestamp, in file names) is filled the same way and
names migrations: the baseline is `migrations/0_init.sql`, every later one is
`<timestamp>_<name>.sql` — a capability ships
`install/migrations/REPLACE_WITH_NOW_<name>.sql` (several are stamped a second apart, in
name order), a project runs `pnpm db:new` — so migrations sort in the order they entered
the project.
Any file added under `template/` or a capability `install/` must use these tokens, not
literal names/IDs/URLs. The same goes for `install-patches/`: patch **context lines** carry
the tokens, so the patch text is rendered (tokens → the project's slug) before `git apply` —
a raw patch will not apply to an already-renamed project.

## Versioning model

Two sides:

1. **Registry (canonical, in this repo):** each `capabilities/<cap>/capability.json` has the
   capability's **latest** `version`, and is installed on demand by `add-edge-capability`.
   `base` is not in `capabilities/`: it is delivered as `template/`, and its latest version
   is `capabilities.base` in `template/.edge-stack.json`.
2. **Per-project (in each generated project):** `.edge-stack.json` records what the project was
   built with and currently has:
   ```json
   { "stack": "edge-stack", "name": "<slug>", "createdWith": "0.1.0",
     "capabilities": { "base": "0.1.0" } }
   ```
   `create-edge-stack` seeds `base` only. `add-edge-capability` adds a key for a capability
   once it's installed. `update-edge-stack` bumps keys as it applies patches.

Current versions (v0.2): `base` 0.2.0 (oRPC contracts on zod 4; 0.1.0 was ts-rest on zod 3),
`email-sending` 0.2.0, `neon-postgres` 0.1.0 (swaps D1 for Neon Postgres; base stays on D1),
`pr-media-r2` 0.1.0 (hosts PR screenshots in R2 for cloud sessions; base leaves them to
GitHub attachments), `production-hardening` 0.1.0 (mostly guided account, GitHub and Access
setup; splits the admin app into its own Worker), `analytics` 0.1.0 (PostHog), `privacy`
0.1.0 (requires `analytics`: regional tracking consent, the policy page and account
erasure). A capability whose installed code a base step leaves untouched keeps its version;
its install patches are still re-cut against the new template.

**Base ships real end-user auth.** The template includes better-auth (email + password,
httpOnly cookie sessions) in `libs/identity`, with no self-service sign-up, plus a
self-contained **admin app** (`apps/admin-frontend`, `libs/admin-api`, `libs/admin-contract`)
with its own separate auth that manages end-users. All of that is part of `base` and is
**not** recorded as a capability.

## Two kinds of patch — don't mix them up

- `capabilities/<cap>/install-patches/` — **install-time** edits: one `git diff` per existing
  project file the capability's `INSTALL.md` modifies, mirroring the project tree
  (`install-patches/<path>.patch`), cut against the current base template. Applied once, by
  `add-edge-capability` through `skills/add-edge-capability/apply-capability.mjs`, which
  renders the placeholders and, when a file has changed since base, seeds the rendered base
  template file as the merge base so `git apply -3` does a real 3-way merge (a patch's
  `index` line names the placeholdered blob, which never exists in a renamed project).
- `patches/<cap>/<from>__<to>/` — **version-to-version** upgrades, enumerated by
  `update-edge-stack`. Every directory under `patches/<cap>/` is read as a version step, so
  install-time patches must never be filed under it.

**Glue** between two capabilities — code that only makes sense when a project has both, such
as `production-hardening`'s Neon app role — lives in `capabilities/<cap>/with/<other>/`, with
its own `install/` and `install-patches/`, cut against a project with both installed (and
their conflicts resolved). `apply-capability.mjs` applies it whichever of the two is
installed second, once that install has no conflicts left (else it says so, and a
`--glue-only` re-run applies it). Glue patches have no template merge base: one that does not
apply is reported as failed, for merging by intent. Keep glue to what cannot live in either
capability alone; a conflict between the two is still resolved by intent, before the glue
runs.

## Patch-authoring contract (used by `update-edge-stack`)

Upgrades live in `patches/<cap>/` (`base` included), one dir per step:

```
patches/<cap>/<from>__<to>/  # semver, e.g. 0.1.0__0.2.0
  PATCH.md                   # REQUIRED — ordered, explicit steps an agent executes
  files/                     # optional — new/replacement files (use placeholders)
  scripts/                   # optional — helper scripts
```

- `PATCH.md` lists exact edits, file adds, dependency bumps, and migrations, top-to-bottom.
- Chain must be **gapless**: each patch's `from` equals the prior `to`. `update-edge-stack`
  refuses to skip versions.
- When you ship a patch, **bump the latest version** to the new `to`: `capability.json`
  `version`, or for `base` both `createdWith` and `capabilities.base` in
  `template/.edge-stack.json`.
- There is **no separate patch list** — `update-edge-stack` reads every capability key present
  in a project's manifest and applies that capability's chain. So a capability added by
  `add-edge-capability` is automatically upgradable.

## Authoring a new capability

1. `mkdir capabilities/<name>/` with `capability.json` (`name`, `version`, `description`),
   `README.md`, `INSTALL.md`, `install/` (placeholdered new files) and `install-patches/`
   (placeholdered git patches for existing files); its upgrades later go in
   `patches/<name>/`. A capability that only makes sense on top of others lists them in
   `capability.json` `requires`: `apply-capability.mjs` refuses to run until the project has
   them, and its patches are cut against the template with them installed, which is then the
   3-way merge base.
2. `INSTALL.md` is the contract `add-edge-capability` executes (copy files, apply patches,
   record version, verify). Use `email-sending/` as the skeleton. Preconditions common to
   every capability (an edge-stack project, not already installed, committed tree, current
   base) live in the `add-edge-capability` skill — an `INSTALL.md` states only its own. **Never describe an edit to
   an existing file in prose** — prose edits are unverifiable and drift silently against the
   template. Generate the patch instead: scaffold the template into a scratch git repo, make
   the edit for real, verify, then `git diff -- <file> > install-patches/<file>.patch` per
   file. Re-cut them whenever the template changes a file they touch.
   Cut them against the **placeholdered** template (a scratch git repo of raw `template/`),
   so their `index` blob hashes are the template's own.
   Files a project should get only when the user asks (one-off tools such as
   `neon-postgres`'s D1 data copy) go in `optional/`, mirroring the project tree;
   `apply-capability.mjs` never copies them, and `INSTALL.md` says when to offer them.
3. **Test it alone and next to every other capability, in both install orders**
   (scaffold → `apply-capability.mjs` → commit → the other one). Files both capabilities
   patch will conflict; resolve them by intent and verify all five checks. Resolve to the
   same text in both orders, so the trees match and any `with/` glue applies to both.
4. **Capabilities stay independent.** An `INSTALL.md` never lists what conflicts with
   another capability or how to resolve it — the installing agent merges by intent, and a
   capability's own resolve rules (what must never come back) say what intent means. A
   capability names another only for a real dependency (its `with/<other>/` glue, setup that
   differs when the other is installed) or a real danger the merge would not reveal — never
   to describe how the two fit together.

## ADRs

Architecture decisions ship **into generated projects** as
`docs/adrs/REPLACE_WITH_TODAY_<topic>.md`: base ones in
`template/docs/adrs/`, a capability's in its `install/docs/adrs/`. Keep them very short. Dated,
not numbered — the token, in the file name and the `Date: REPLACE_WITH_TODAY` header, records
when the decision entered that project. Then Decision / Why / Trade-offs sections. No scope/status
fields: these are one-or-few-person projects.

**Never add an ADR without asking first** — propose the decision and wait for a yes; a change
that feels architectural is not by itself permission to write one.

## Template invariants

`template/` is the canonical edge-stack starter. Everything in it is tokenized with
`project-name` / `project_name` so `create-edge-stack` can rename it; never commit a literal
project name. A template must **never ship real infrastructure IDs**, and must keep the hand-configured
setup surface minimal — three rules enforce this:

- The committed `apps/backend/wrangler.jsonc` is local-dev only and binds D1 **by name with
  no `database_id`**. It is the vite build's INPUT: the backend worker is bundled by
  `vite build` + `@cloudflare/vite-plugin`, which emits
  `apps/backend/dist/worker/wrangler.json`, and `scripts/gen-wrangler-config.mjs` stamps
  each deploy target's config onto that emitted file (written beside it as
  `dist/worker/<outFile>`); every target resolves its D1 id **by name at deploy
  time** (preview-deploy.yml find-or-creates the per-branch preview D1; staging-deploy.yml
  find-or-creates `<slug>-staging`; prod-deploy.yml resolves `<slug>-prod` and deliberately
  refuses to create it). Never add a literal `database_id` to `wrangler.jsonc` — otherwise
  every PR preview would bind one shared DB instead of its own clone, and a real prod UUID
  would be committed.
- CI needs exactly **one** repo secret, `CLOUDFLARE_API_TOKEN`, and **zero** repo variables.
  The Cloudflare account id and the account's `workers.dev` subdomain are derived from the
  token by the `.github/actions/cloudflare-env` composite action (`CLOUDFLARE_ACCOUNT_ID` is
  an optional multi-account override only). Anything new that a deploy needs must be derived
  by convention or added to that action — do not grow the list of things a user configures
  by hand in GitHub.
- The production hostname is the placeholder `REPLACE_WITH_PROD_URL` in
  `scripts/lib/environments.mjs`, filled in during Cloudflare setup.
  `BETTER_AUTH_SECRET` is only ever a local-dev value in `wrangler.jsonc` `vars` (real ones
  are worker secrets set out of band).

`neon-postgres` deliberately relaxes the one-secret rule for the projects that install it:
they need `NEON_API_KEY` as well (still zero repo variables, no stored connection strings),
because a Neon key cannot be derived from the Cloudflare token. `production-hardening` keeps
the same secret names but gives production its own values in a `production` GitHub
environment, and with `neon-postgres` adds `DB_APP_PASSWORD` (and pins `NEON_PROJECT_ID`) —
the restricted role's password is the one thing no API can hand back.

The template's `CLAUDE.md` is loaded into every session of every generated project, so it is
a short rulebook with its own line budget and maintenance rules — keep to them. Reference
material goes in `template/docs/` or a lib's own `README.md` (indexed from
`template/README.md`), and test traps in `template/tests/README.md`. Project docs describe the
project as it is, not how edge-stack set it up. **Setup lives only in the install prompts** —
`create-edge-stack`'s steps for base, a capability's `INSTALL.md` for the rest: creating
resources (buckets, databases, tokens), setting secrets or environment variables, plans and
accounts a feature needs. Never put it in a project's README or `docs/`. A capability ships its reference as `install/docs/<topic>.md`
and patches only the README index, the few rules it adds to `CLAUDE.md`, and the lines of
existing docs it makes untrue.

The template is verified green end-to-end (`pnpm install`, `type-check`, `lint`, `build`,
Playwright `test`). Keep it that way: when you change the template, re-run all five on a
scaffolded copy before committing.
To prove it also deploys and runs on Cloudflare, follow `testing/README.md` (uploads a preview
alias of the `alonbd-skills-test` Worker with a throwaway D1, smoke-tests it, then cleans up).

Changing a template file that a capability patches also **invalidates that patch** — the
context lines no longer match. After any template edit, check
`capabilities/*/install-patches/` for a patch on the same path and re-cut it (see *Authoring
a new capability*, step 2).

## Cross-tool (Codex) plan

Logic is tool-neutral on purpose: the real work is in `template/`, `capabilities/`, and the
step lists inside each `SKILL.md`. To support OpenAI Codex later, add thin adapters (a
`~/.codex/prompts/<skill>.md` per skill, or `AGENTS.md` entries) that point at the same skill
steps — Codex invokes explicitly (no auto-discovery), which matches how these are meant to be
used anyway. Keep skill bodies executable-as-prose so a non-Claude agent can follow them.

## Conventions

- Bump `marketplace.json` and `plugin.json` `version` on releases; keep them in sync with the
  registry.
- New library/framework usage in a patch or capability: verify current APIs via the Context7
  MCP server, don't rely on training data.
- Server code in `template/` and in a capability's `install/` logs through `@lib/logging`
  (`moduleLogger("<package>/<path>")`), never `console.*` — the template's ESLint config
  enforces it, so a new lib that logs needs `@lib/logging` in its `package.json` and a
  `../logging` tsconfig reference. The `@logtape/*` packages are pinned to an exact version;
  bump all three together.
- Comments in code and config files (template, `install/`, `install-patches/`) are rare:
  only for things that would really bite someone who doesn't know them. Comments describe
  the current state only — never what changed, was removed, or used to be.
