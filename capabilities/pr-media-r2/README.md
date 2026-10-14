# Capability: `pr-media-r2`

PR screenshots and videos hosted in R2, for projects worked on from Claude Code cloud
sessions. Base leaves media to GitHub attachments, which a cloud session can't rely on: its
GitHub writes store `![alt](url)` as `[alt](url)`
([anthropics/claude-code#89540](https://github.com/anthropics/claude-code/issues/89540)), and
its `gh` may be too old or not signed in.

- `scripts/pr-media/upload.mjs` puts each file in the `<slug>-pr-media` R2 bucket under a
  random-UUID key and prints ready-to-paste markdown. It signs requests for R2's S3 endpoint
  with `CLOUDFLARE_API_TOKEN`, or falls back to the `wrangler login` session.
- `.github/workflows/restore-image-embeds.yml` puts the stripped `!` back on R2 image links
  in PR bodies and comments.
- The bucket is public-read with a 30-day lifecycle rule: links are unguessable, not private.

Not installed by default: it needs a bucket, a `CLOUDFLARE_API_TOKEN` with R2 write access in
the cloud environment and a network allowlist entry, and it trades GitHub's access control for
a public bucket. `create-edge-stack` offers it when the user works from cloud sessions.

`INSTALL.md` is the contract `add-edge-capability` executes. The installed
`docs/pr-media.md` is the project-side reference.
