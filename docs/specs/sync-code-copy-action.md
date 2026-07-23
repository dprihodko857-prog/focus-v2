# SYNC-CODE-COPY-001 - Sync Code Copy Action

Status: IMPLEMENTED_LOCAL_COMMITTED

## Owner Decision

The owner asked to continue project work on 2026-07-23 after TASK-017. Earlier owner direction allowed autonomous continuation through bounded local tasks. Production deployment and git push remain separate explicit gates.

## Goal

Make it easier and less error-prone to connect another device by adding a one-click copy action for the current sync account code.

## In Scope

- Add a `Скопировать` action next to the readonly sync account code.
- Disable the action when no sync account code exists.
- Copy through the Clipboard API when available.
- Fall back to selecting the readonly code field when direct clipboard write is unavailable.
- Show clear status messages for copied, manual fallback, and missing-code states.
- Bump the service worker cache because `index.html`, `app.css`, and `app.js` are part of the PWA shell.
- Add contract tests for the UI and client wiring.

## Out of Scope

- Backend API changes.
- Account-code format changes.
- QR codes or pairing links.
- Production deployment.
- Git push, tags, or release work.

## Acceptance Criteria

- The sync modal shows a copy action next to the account code field.
- The copy action is disabled until a sync account exists.
- Successful copy updates the sync status.
- Clipboard fallback selects the code field and tells the user to copy manually.
- Existing sync, PWA, install, and layout tests pass.

## Required Checks

- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --test tests/sync-integration-assets.test.mjs tests/install-quality-css.test.mjs tests/desktop-layout-css.test.mjs`
- `npm.cmd run test`
- `git status --short`
- `git diff --stat`
