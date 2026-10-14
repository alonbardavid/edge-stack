# PR media

PR screenshots and videos are hosted in the `project-name-pr-media` R2 bucket rather than as
GitHub attachments, so that Claude Code cloud sessions can upload them too.

```bash
node scripts/pr-media/upload.mjs after.png flow.webm
```

It prints ready-to-paste markdown: `![…](url)` for an image, a bare URL for a video (GitHub
plays only its own attachments inline, so an R2-hosted video is a click-through link). Keep
each image on its own line, as printed.

Media lives under random-UUID keys, served from the bucket's public r2.dev URL, and a
lifecycle rule deletes it after 30 days. Reading is public and unauthenticated — the random
keys are all that keep a link unguessable — so nothing private goes in the bucket, and
nothing long-lived links to it.

GitHub writes from a cloud session store `![alt](url)` as `[alt](url)`
([anthropics/claude-code#89540](https://github.com/anthropics/claude-code/issues/89540)).
`.github/workflows/restore-image-embeds.yml` puts the `!` back, in PR bodies and comments, on
every line that is nothing but a link to an R2-hosted image. Delete it once that issue is
fixed.
