# Quote Seed Import Contract

## Context

TASK-091 added an explicit production quote seed helper, but the import path itself needed a direct contract test. The helper should be safe to validate locally without generating the full production-sized catalog for every import behavior assertion.

## In Scope

- Keep the CLI default seed size at 450 quotes per category.
- Let API callers pass a smaller `perCategory` value for local tests.
- Cover `replaceSeed: true` behavior with a file-backed sync database.
- Cover `replaceSeed: false` deduplication after seed records already exist.
- Assert that manual non-seed quote records are preserved.

## Out Of Scope

- Running any import against a production database.
- Changing default production quote volume.
- Changing generated quote content.
- Adding a third-party content provider.
- Deployment, git push, tags, or release work.

## Acceptance

- `node scripts/seed-production-quotes.mjs summary` still reports 6300 quotes across 14 categories.
- `importProductionQuoteSeed()` defaults to the production threshold when `perCategory` is omitted.
- Tests can run import assertions with a smaller `perCategory` value.
- Replacing seed records removes stale `focus-seed-*` rows and keeps manual quotes.
- Preserving seed records dedupes existing ids instead of growing duplicate rows.
