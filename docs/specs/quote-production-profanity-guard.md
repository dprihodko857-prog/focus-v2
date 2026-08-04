# Quote Production Profanity Guard

## Scope

Focus must not serve production daily quote items that match the local profanity guard. The guard is server-side and blocks unsafe active catalog entries before they can appear in generated daily quote sets.

## In Scope

- Validate active quote catalog entries before production output.
- Reject or rebuild daily quote sets when a selected item becomes blocked.
- Keep matched profanity details out of public responses and diagnostics.
- Provide local audit scripts for production quote API/catalog checks.
- Cover the guard with server tests.

## Out Of Scope

- Replacing the existing quote catalog.
- Adding a third-party moderation service.
- Storing user-generated quote submissions.
- Production deploy, push, or credential changes.

## Verification

- `scripts/audit-production-quotes.mjs`
- `scripts/verify-production-quotes-api.mjs`
- `tests/focus-sync-server.test.mjs`
- Current full local regression on 2026-08-04: `npm.cmd run test` passed 219/219.
