# edge-stack

Edge stack is a very opinionated scaffolding skill for setting up SaaS products with
Cloudflare and GitHub.

Going beyond your regular template it's designed to give a foundation for mature and modern
products and workflows, by default it offers:

- A modern development workflow with e2e test CI, per branch deployment and database branching
- Common skills including convention PR review, security, accessibility and other audit support
- An admin UI for management
- Initial entities common for all SaaS products (logging, pagination, permissions...)
- Database setup and migrations on D1
- Monorepo structure with clear boundaries
- Designed to easily integrate common capabilities (such as API, mobile apps...)
- ADRs for every choice and clear documentation for agents

It also includes additional capabilities that can be incorporated during initial scaffolding
or later on:

- Email sending and management (including unsubscribe) using Cloudflare emails. Email
  template authoring
- Analytics using PostHog, with events from both client and server
- Privacy controls and GDPR/CCPA support
- Replacing D1 with Neon Postgres (and keeping all the modern workflow)
- File upload, including previews, filtering malware and adult content
- Translations support - coming soon
- Agent integration using Cloudflare AI Gateway
- Exposing API with key management

**The tech stack at a glance:** Cloudflare Workers, D1, GitHub Actions, Hono, oRPC,
drizzle-orm, better-auth, React, React Query, Mantine, Playwright, pnpm and Turbo.

It is based on my own strongly held opinions and conventions (and experience with gotchas),
but it is very easy to change: just fork and have an agent update it.

## The skills

The skills are invoked **explicitly**, by name or by asking for them. There is no
auto-discovery: the plugin never acts on a project unless you ask it to.

### `create-edge-stack`

Scaffolds a new project from the bundled template, renames it to your slug, installs
dependencies, runs the tests, and then walks you through the GitHub and Cloudflare setup:
the API token, the staging and production databases, the first deploy of each Worker, the
auth secrets, the production hostname and the first admin account. Every step is either run
for you or handed to you as an exact command, and the wrap-up lists which is which.

### `add-edge-capability`

Adds a capability to an existing project. New files are copied in with the placeholders
rendered, and existing files are changed by applying git patches cut against the template,
with a real 3-way merge when a file has drifted since. A capability is recorded in the
project's manifest with its own version, so it stays upgradable.

| Capability             | Adds                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `email-sending`        | Transactional email, react-email templates, sign-up with verification, password reset    |
| `analytics`            | PostHog from the SPA and the Worker                                                      |
| `privacy`              | Tracking consent, privacy policy, account delete, restore and erasure (needs `analytics`) |
| `neon-postgres`        | Neon serverless Postgres instead of D1, one Neon branch per environment                  |
| `production-hardening` | Separate production account, GitHub environment, Cloudflare Access, split admin Worker   |
| `pr-media-r2`          | PR screenshots and videos in R2, for Claude Code cloud sessions                          |

Capabilities are independent and can be installed in any order. Where two of them touch the
same file, the install reports the conflict and it is resolved by intent.

### `update-edge-stack`

Upgrades a project in place. It reads the versions recorded in the project's
`.edge-stack.json`, builds the chain of version-to-version patches for the base stack and for
every installed capability, shows the plan, applies the patches in order, bumps the manifest
after each one, and runs type-check and the tests at the end. The chain is gapless by
construction: a missing step stops the upgrade rather than skipping a version.

## Install

This repo is both the plugin and its own one-plugin marketplace. In Claude Code:

```
/plugin marketplace add alonbardavid/edge-stack
/plugin install edge-stack@edge-stack
```

or from a shell:

```
claude plugin marketplace add alonbardavid/edge-stack
claude plugin install edge-stack@edge-stack
```

The skills are namespaced by the plugin: run `/edge-stack:create-edge-stack` directly, or ask
Claude to create a new edge-stack project. The same goes for `/edge-stack:add-edge-capability`
and `/edge-stack:update-edge-stack`, run from inside a project. Pull a new release with
`claude plugin update edge-stack@edge-stack`.

To work on the plugin itself, load your clone for one session, or add it as a marketplace
(a local marketplace loads in place, so edits take effect without reinstalling):

```
claude --plugin-dir /path/to/the/clone
/plugin marketplace add /path/to/the/clone
```

## How a project stays upgradable

Every generated project carries an `.edge-stack.json`:

```json
{
  "stack": "edge-stack",
  "name": "acme-app",
  "createdWith": "0.2.0",
  "capabilities": { "base": "0.2.0", "email-sending": "0.2.0" }
}
```

The plugin's `capabilities/` directory is the registry. Each capability has a
`capability.json` with its latest version, and an `install/` tree and `install-patches/` for
adding it to a project. `base` is the template itself, whose `.edge-stack.json` carries its
latest version. Upgrades live in `patches/<capability>/`, `base` included: a
`<from>__<to>/` directory per step, each with a `PATCH.md` an agent follows top to bottom.
Because `update-edge-stack` reads the manifest rather than a fixed list, anything
`add-edge-capability` installed is upgraded by the same run.

## Layout

```
.claude-plugin/plugin.json        plugin manifest
.claude-plugin/marketplace.json   one-plugin marketplace pointing at the repo root
skills/
  create-edge-stack/SKILL.md      scaffold a new project from template/
  add-edge-capability/SKILL.md    add a capability; apply-capability.mjs does the file work
  update-edge-stack/SKILL.md      apply patch chains to upgrade a project
template/                         the project starter, with project-name placeholders
capabilities/                     the installable capabilities
  <capability>/                   capability.json, README.md, INSTALL.md, install/,
                                  install-patches/
patches/                          version-to-version upgrades, read by update-edge-stack
  <capability>/<from>__<to>/      PATCH.md, files/, scripts/ (base included)
CLAUDE.md                         maintainer guide: versioning, patch and capability authoring
testing/README.md                 deploy-test a scaffolded app to Cloudflare from a cloud session
```

`patches/` is created by the first upgrade step.

A generated project documents itself: its `README.md` indexes the architecture, development,
deployment and testing docs, and each capability ships its reference as a doc in the project.
