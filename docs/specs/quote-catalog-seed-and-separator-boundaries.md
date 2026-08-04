# Quote Catalog Seed And Separator Boundaries

## Scope

Focus needs a large local production quote seed helper and a narrower profanity mask parser. Ordinary punctuation and separators should behave as word boundaries, while explicit mask characters still support masked profanity detection.

## In Scope

- Treat ordinary separators as boundaries in masked profanity matching.
- Keep explicit mask characters such as `*`, `#`, `_`, `?`, `•`, and `·` as mask tokens.
- Add a server regression test proving ordinary separators do not create false positives.
- Add a local production quote seed helper that can summarize and import generated seed quotes.
- Keep seed import explicit and operator-run; do not import seed data during normal server startup.

## Out Of Scope

- Running the seed import against production.
- Replacing existing verified quote catalog entries automatically.
- New external content provider or moderation provider.
- Production deploy, push, or release work.

## Verification

- `node --check scripts/seed-production-quotes.mjs`
- `node scripts/seed-production-quotes.mjs summary`
- `node --test tests/focus-sync-server.test.mjs`
- `node --test tests/production-quote-seed.test.mjs`
- Current full local regression on 2026-08-04: `npm.cmd run test` passed 222/222.
