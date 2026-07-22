# Current State

Status: DRAFT

## Implemented

- PWA manifest, service worker, app icons, splash assets, and install diagnostics are present.
- Main app UI includes calendar, reminders, schedules, birthdays, notes, diary, useful services entry, and settings.
- Important app data has IndexedDB-backed storage modules and sync client integration.
- Node backend under `server/sync-server.mjs` supports sync, auth endpoints, push subscriptions, reminder dispatch, and push delivery event history.
- Diary access is protected by a four digit PIN gate in the current app behavior.
- TASK-003 is implemented locally: transient reminder push failures now enter bounded retry diagnostics, and max-attempt exhaustion is visible in diagnostics/events.
- Push notification controls were hotfixed after device QA: when permission exists but the device is not subscribed, the reminders center exposes a clear `Подключить` action and allows `Тест` to register before sending.

## In Progress

- No Project Maestro task is currently in progress.

## Known Issues

- Git baseline was unavailable at the start of the 2026-07-22 Project Maestro cycle.
- No `docs/agent` memory existed before this cycle.
- No lint, typecheck, build, or dev-server scripts are configured in `package.json`.
- Git required adding this local path to global `safe.directory` because the sandbox-created `.git` ownership triggered Git's safety check.

## Verification Baseline

- Last checked: 2026-07-22
- Commands:
  - `git status --short`
  - `git rev-parse --show-toplevel`
  - `npm.cmd test`
- Result: Git reported that `focus-v2` was not a repository before baseline initialization.
- Current result: local Git repository exists; TASK-003 and the push-controls hotfix are committed locally and deployed; `npm.cmd test` passed 85/85 after the hotfix.

## Open Questions

- Which next product/runtime task should be promoted to `READY`.
- Whether future backend/deployment changes should be handled only after a separate owner deployment approval.
