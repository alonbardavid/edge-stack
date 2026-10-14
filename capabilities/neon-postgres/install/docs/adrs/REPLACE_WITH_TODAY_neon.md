# Neon

Date: REPLACE_WITH_TODAY

## Decision

Postgres is hosted on Neon: production on the project's default branch, staging and every
preview on a branch of their own.

## Why

Neon has a good free tier, and its production scaling is very convenient for serverless.
Branches are effectively unlimited, don't increase costs substantially, and are easy to work
with. Its HTTP API makes it easy to run from Workers.

PlanetScale was the alternative. Its branching is limited, and each branch requires its own
provisioned server, which massively increases costs. Its Postgres offering is also still not
as rich as its MySQL one.

## Trade-offs

Neon is a second vendor next to Cloudflare, with its own account and API key.
