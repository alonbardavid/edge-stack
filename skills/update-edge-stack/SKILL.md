---
name: update-edge-stack
description: Upgrade an existing edge-stack project to newer versions by applying ordered codemod-style patches, per capability (base plus any added capabilities), based on the versions recorded in the project's .edge-stack.json. Invoke explicitly when the user asks to update/upgrade their edge-stack project.
---

# update-edge-stack

Upgrade an existing edge-stack project in place by applying the patch chain for each
capability it has, from the project's recorded versions up to the latest in the registry.

**Plugin root:** bundled assets live under `${CLAUDE_PLUGIN_ROOT}` (the `edge-stack` plugin
dir); if unset, use this skill file's grandparent (the repo root). A capability's latest
version is `version` in `${CLAUDE_PLUGIN_ROOT}/capabilities/<cap>/capability.json` — for
`base`, which is the template itself, `capabilities.base` in
`${CLAUDE_PLUGIN_ROOT}/template/.edge-stack.json`. Its ordered upgrades are
`${CLAUDE_PLUGIN_ROOT}/patches/<cap>/<from>__<to>/PATCH.md`.

## 1. Locate and read the project manifest

- Confirm cwd (or the path the user gives) is an edge-stack project: it must contain
  `.edge-stack.json`. If not, stop and explain — only edge-stack projects can be updated.
- Read `.edge-stack.json`. It maps each installed capability to its current version, e.g.
  `{ "capabilities": { "base": "0.2.0" } }` (plus a key per add-on the project has).
- Ensure the working tree is clean (or warn the user) — patches edit files in place; a clean
  tree makes the diff reviewable and reversible.

## 2. Compute the patch plan

For **each** capability key in the project's `capabilities`:

1. Read the capability's latest version (see above) → `latest`.
2. If the project's version == `latest`, skip it.
3. Otherwise, list `${CLAUDE_PLUGIN_ROOT}/patches/<cap>/` and build the ordered
   chain of `<from>__<to>` dirs that walks from the project's version up to `latest`
   (sorted by semver; each patch's `from` must equal the running version). If the chain has a
   gap (no patch bridges a step), stop and report it — do not skip versions silently.

Present the full plan (capability → version steps) to the user before applying anything.

## 3. Apply patches in order

For each capability, for each patch dir in order:

1. Read `PATCH.md` and follow its steps exactly (edits, file adds from `files/`, dependency
   bumps, new migrations, scripts in `scripts/`). Honor the placeholder convention
   (`project-name` / `project_name` → the project's slug, `REPLACE_WITH_TODAY` /
   `REPLACE_WITH_NOW` → the date / timestamp the file lands) for any copied files.
2. After the patch succeeds, **bump that capability's version in `.edge-stack.json`** to the
   patch's `to` version. Update incrementally so a mid-chain failure leaves an accurate record.
3. If a patch fails or is ambiguous, stop, report which patch and why, and leave the manifest
   at the last fully-applied version.

## 4. Verify

After all patches:

```bash
pnpm install
pnpm type-check
pnpm test
```

Report results honestly. If tests fail, surface the output and stop rather than claiming success.

## 5. Wrap up

Summarize what was upgraded (capability: from → to), the new `.edge-stack.json`, the verify
results, and anything the user must do manually (e.g. set a new secret, run a remote
migration). Suggest committing the result as its own reviewable change.

## Notes

- Upgrades for every capability, `base` included, live under `${CLAUDE_PLUGIN_ROOT}/patches/`.
  Patches added for a capability installed by `add-edge-capability` are picked up here
  automatically — there is no separate patch list.
- Patch-authoring contract (naming, `PATCH.md` shape) is in the repo `CLAUDE.md`.
