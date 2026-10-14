---
name: add-edge-capability
description: Add a new capability (e.g. email-sending, neon-postgres, production-hardening, analytics) to an existing edge-stack project by applying the capability's install steps and recording it with its own version in .edge-stack.json. Invoke explicitly when the user asks to add a feature/capability to their edge-stack project.
---

# add-edge-capability

Add an optional capability to an existing edge-stack project: copy its files, wire it in,
and record it (with its own version) in the project's `.edge-stack.json` so
`update-edge-stack` can keep it current.

**Plugin root:** bundled assets live under `${CLAUDE_PLUGIN_ROOT}` (the `edge-stack` plugin
dir); if unset, use this skill file's grandparent (the repo root). Capabilities live in
`${CLAUDE_PLUGIN_ROOT}/capabilities/<name>/`.

## 1. Identify project and capability, check preconditions

These apply to every capability; an `INSTALL.md` only adds its own (e.g. a "Before you
install" section).

- Confirm cwd (or the given path) is an edge-stack project (contains `.edge-stack.json`). If
  not, stop and explain.
- List the capabilities: every directory under `${CLAUDE_PLUGIN_ROOT}/capabilities/`,
  described by its `capability.json`. If the user named a capability, validate that it
  exists.
- If the capability key is **already** in the project's `.edge-stack.json` `capabilities`,
  stop and tell the user to use `update-edge-stack` instead.
- The working tree must be committed: the 3-way fallback in step 2 needs the project's files
  in the git index, and a clean tree makes the install reviewable as one diff. If it isn't,
  ask the user to commit or stash first.
- Install patches are cut against the **current** base template. If the project's
  `capabilities.base` is older than the template's (`capabilities.base` in
  `${CLAUDE_PLUGIN_ROOT}/template/.edge-stack.json`), offer to run `update-edge-stack`
  first — otherwise expect more 3-way merges and conflicts.
- Read the capability's `INSTALL.md` for anything capability-specific before changing files.

## 2. Apply the capability's install contract

- Read `${CLAUDE_PLUGIN_ROOT}/capabilities/<name>/INSTALL.md` and follow it exactly. An
  install has two mechanical halves, both done by one script from the project root:

  ```bash
  node "${CLAUDE_PLUGIN_ROOT}/skills/add-edge-capability/apply-capability.mjs" \
    "${CLAUDE_PLUGIN_ROOT}/capabilities/<name>" [--set TOKEN=value ...]
  ```

  - **New files** — copies `install/` into the project, path-mapped, replacing the
    `project-name` / `project_name` placeholders with the slug from `.edge-stack.json`,
    `REPLACE_WITH_TODAY` with today's `YYYY-MM-DD` and `REPLACE_WITH_NOW` with the current
    `YYYYMMDDHHMMSS`, in both contents and file names (it dates any ADR the capability ships
    as `docs/adrs/REPLACE_WITH_TODAY_<topic>.md` and stamps its migrations).
  - **Existing files** — renders the same placeholders in each `install-patches/<path>.patch`
    (context lines carry the tokens, so a raw patch will not apply to a renamed project) and
    `git apply`s it. A patch on a dated file (`docs/adrs/REPLACE_WITH_TODAY_<topic>.md`)
    targets the project's own copy, whose date is when the project was created. `--set` renders any extra token an `INSTALL.md` asks for (e.g.
    `--set REPLACE_WITH_EMAIL_FROM=noreply@example.com`).
- A patch that does not apply means the file changed since the base template (local edits,
  or another capability). The script retries it as a real 3-way merge: it writes the
  rendered base template file into the project's object store and points the patch at it,
  then runs `git apply -3`. It reports every file as applied, 3-way merged, conflicted, or
  failed, and exits 2 if anything needs you.
- Resolve conflict markers, and apply anything that failed, **by intent** (merge, don't
  clobber). Never silently skip a patch — tell the user which files needed hand-merging and
  why.
- **Glue.** When the project already has a capability that this one ships glue for (or that
  ships glue for this one) — a `with/<other>/` directory on either side — the script applies
  it after the capability's own files. If those left conflicts, it reports **GLUE PENDING**
  instead: resolve them, `git add` the files, then run the same command with `--glue-only`.
- Do **not** hardcode secrets — tell the user which `wrangler secret put` / GitHub secret to
  set, and which `wrangler.jsonc` bindings/vars to add.

## 3. Record the version

Add `"<name>": "<version from capability.json>"` to `capabilities` in `.edge-stack.json`.
This is what gives the capability its own independently-trackable version, so future
`update-edge-stack` runs apply only its `${CLAUDE_PLUGIN_ROOT}/patches/<name>/` chain.

## 4. Verify

```bash
pnpm install
pnpm type-check
pnpm lint
pnpm build
pnpm test
```

Report results honestly; stop on failure with the output.

## 5. Wrap up

Summarize what was added, the new `.edge-stack.json`, any manual steps (secrets, migrations,
provider signup), and the verify results.

## Authoring a new capability

To create a brand-new capability (so it can later be added here and upgraded by
`update-edge-stack`), follow the capability-authoring contract in the repo `CLAUDE.md`:
add `${CLAUDE_PLUGIN_ROOT}/capabilities/<name>/` with `capability.json`, `README.md`,
`INSTALL.md`, `install/` (new files) and `install-patches/` (git patches for existing files),
plus `with/<other>/` for glue with another capability; its version-to-version upgrades go
in `${CLAUDE_PLUGIN_ROOT}/patches/<name>/`. Edits to existing files are **patches, never
prose steps**. `email-sending` and `neon-postgres` are the worked examples;
`production-hardening` shows glue.
