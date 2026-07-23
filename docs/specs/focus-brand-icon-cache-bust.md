# FOCUS-BRAND-ICON-CACHE-BUST-001 - Force New Logo Icon URLs

Owner decision: owner reported that the browser tab favicon and iPhone Home Screen icon still showed the old logo after reinstall on 2026-07-23.

## Goal

Force browsers and installed PWA surfaces to load the new Focus logo by moving runtime icon references to versioned asset URLs.

## Context

- TASK-013 replaced the PNG contents at the existing icon paths.
- Browser favicons and iOS Home Screen icons can remain cached even after a file is replaced at the same URL.
- Reinstalling an iPhone Home Screen shortcut can still reuse cached `apple-touch-icon.png`.
- The fix is to keep compatibility files but point the app runtime, manifest, service worker, and notification options at new versioned URLs.

## In Scope For TASK-014

- Generate versioned logo and icon files with `v2` names.
- Update the HTML favicon and Apple touch icon links to versioned paths.
- Update manifest icon and shortcut icon paths to versioned paths.
- Update notification icon and badge paths to versioned paths.
- Update service worker cache entries and notification icon paths.
- Bump the service worker cache.
- Add/update contract tests to prevent old runtime icon paths from returning.

## Out Of Scope

- Changing the logo drawing itself.
- Removing old compatibility icon files.
- Splash screen redesign.
- Backend, sync, auth, or push delivery behavior changes.
- Production deployment, git push, tags, or release work.

## Acceptance Criteria

- Browser favicon link uses a new URL.
- iOS Apple touch icon link uses a new URL.
- Manifest install icons use new URLs.
- Push/local notification icon and badge use new URLs.
- Service worker precaches the new URLs.
- Existing tests pass.

## Required Checks

- `node --check scripts/generate-focus-logo-assets.mjs`
- `node --check public/js/notifications.js`
- `node --check public/service-worker.js`
- `node --test tests/install-quality-css.test.mjs tests/sync-integration-assets.test.mjs tests/desktop-layout-css.test.mjs tests/focus-notifications.test.mjs`
- `npm.cmd run test`
- `git status --short`
- `git diff --stat`
