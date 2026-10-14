# Capability: `email-sending`

Transactional email from the Worker, plus the end-user flows built
on it:

- `@lib/email-ds` (react-email layout and runtime rendering) and `@lib/email-service`
  (`sendEmail` over Cloudflare's `send_email` binding).
- Self-service sign-up with email verification, and forgot / reset password, in better-auth
  and the frontend.
- Per-environment senders: only production sends from the bare `EMAIL_FROM`; every other
  target tags its local part (`noreply+staging@…`).
- e2e coverage against miniflare's simulated inbox, and a template preview server
  (`pnpm email:dev`).

Local dev and tests need no setup. Real delivery needs Workers Paid and a sender domain
onboarded in Cloudflare. Runtime rendering adds ~184 kB gzip to the Worker.

`INSTALL.md` is the contract `add-edge-capability` executes: `install/` holds new files,
`install-patches/` one git patch per existing file it edits. The installed
`docs/emails.md` is the project-side reference.
