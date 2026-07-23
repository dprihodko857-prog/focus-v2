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
- PWA/mobile push hardening was deployed and verified on iPhone by the owner on 2026-07-23.
- TASK-004 is implemented locally: concurrent first-load sync account creation is coalesced in the client to avoid duplicate remote accounts.
- TASK-005 is implemented locally: diary PIN settings now migrate a valid legacy fallback into IndexedDB and clear stale `localStorage` fallback copies after successful IndexedDB reads/writes.
- TASK-006 is implemented locally: legacy `localStorage` keys for important app data are removed after successful IndexedDB migration/read cleanup.
- TASK-007 is implemented locally: the push event log now shows retry attempt counts and next retry time when server events include them.
- TASK-008 is implemented locally: fire-and-forget client sync pushes are guarded from unexpected background rejection.
- TASK-009 is implemented locally: same-collection client push snapshots are serialized to avoid older in-flight pushes overwriting newer snapshots.
- TASK-010 is implemented locally: expected background sync `offline` results now show the deferred sync status instead of failing silently.

## In Progress

- No Project Maestro task is currently in progress.

## Known Issues

- Git baseline was unavailable at the start of the 2026-07-22 Project Maestro cycle.
- No `docs/agent` memory existed before this cycle.
- No lint, typecheck, build, or dev-server scripts are configured in `package.json`.
- Git required adding this local path to global `safe.directory` because the sandbox-created `.git` ownership triggered Git's safety check.

## Verification Baseline

- Last checked: 2026-07-23
- Commands:
  - `git status --short`
  - `git rev-parse --show-toplevel`
  - `npm.cmd test`
- Result: Git reported that `focus-v2` was not a repository before baseline initialization.
- Current result: local Git repository exists; TASK-010 checks passed locally; `npm.cmd run test` passed 92/92.

## Open Questions

- Which next product/runtime task should be promoted to `READY`.
- Whether future backend/deployment changes should be handled only after a separate owner deployment approval.
