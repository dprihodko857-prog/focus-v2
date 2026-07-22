# Quality Gates

## Required Checks

- Lint: not configured in `package.json`.
- Typecheck: not configured in `package.json`.
- Unit tests: `npm.cmd test`
- Integration tests: included in `tests/*.test.mjs` where present.
- Build: not configured; static app files are served directly from `public/`.
- Smoke/browser: required for UI layout or PWA behavior changes when feasible.
- Security/privacy: required for auth, diary privacy, push permissions, sync, personal data, logs, and external services.

## Completion Rule

Use `DONE` only when required checks pass or the owner explicitly accepts the remaining risk.

