# Entitlement Audit UI

## Context

TASK-057 added a bounded account-scoped audit log for paid feature access events. The log is useful for debugging payment activation, YooKassa return checks, manual activation, and entitlement expiration, but it is not visible from the app.

## Goal

Expose recent paid feature access events inside the existing Settings subscription panel for the current sync account.

## Scope

- Add a compact `Paid feature events` diagnostics block under the existing paid feature list in Settings.
- Load events through `scheduleSync.getEntitlementEvents()`.
- Show safe states for:
  - no sync account
  - loading
  - offline/error
  - empty event history
  - populated event history
- Format event status, origin, payment status, reason, creation time, and expiration when present.
- Refresh the event history when:
  - Settings is opened
  - paid feature access is refreshed
  - a sync account is created or connected
  - a pending payment status check finishes
  - online recovery runs
- Keep the Useful modal focused on the product-level subscription status, not the technical audit list.
- Bump the PWA service worker cache to `focus-pwa-v83`.

## Out Of Scope

- New backend endpoints or event storage changes.
- Public audit page.
- Admin dashboard.
- Exporting event history.
- Live YooKassa calls.
- Production deploy, git push, tags, or release work.

## Acceptance Criteria

- Settings contains a visible audit diagnostics block for paid feature events.
- The block does not show stale events after account disconnect or account switch.
- The block renders useful no-account, loading, offline, empty, and populated states.
- Events loaded from the existing sync client are formatted without exposing raw JSON.
- Existing paid feature status and Useful subscription panel behavior remain unchanged.
- Existing focused and full tests pass locally.

## Verification

- `node --check public/js/app.js`
- `node --check public/js/sync.js`
- `node --check public/service-worker.js`
- `node --test tests/sync-integration-assets.test.mjs tests/install-quality-css.test.mjs tests/desktop-layout-css.test.mjs tests/legal-pages.test.mjs`
- `npm.cmd run test`
- `git diff --check`
- `git status --short`
- `git diff --stat`
