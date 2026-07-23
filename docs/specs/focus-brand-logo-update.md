# FOCUS-BRAND-LOGO-UPDATE-001 - Update Focus Logo Assets

Owner decision: owner provided the new logo concept image in chat on 2026-07-23.

## Goal

Replace the project logo with the new Focus mark based on the Russian letter `Ф`, target geometry, and the existing orange/graphite brand palette.

## Context

- The app uses one visible sidebar logo asset and several PWA install assets.
- Manifest, Apple touch icon, favicon, maskable icons, notification icons, and service worker cache entries all depend on those files.
- The supplied concept defines a dark rounded app tile, orange `#F97316` focus mark, graphite target arcs, and safe area around the symbol.
- The update should keep existing file paths so the app, manifest, and notifications continue to work.

## In Scope For TASK-013

- Add a reproducible logo asset generator.
- Replace `public/assets/focus-logo.png`.
- Replace `public/assets/brand/focus-app-icon-reference.png`.
- Replace favicon, Apple touch, standard PWA icons, and maskable icons.
- Adjust sidebar logo CSS so the new ready-made tile is not double-shrunk.
- Bump the service worker cache because cached app assets changed.
- Add/update asset contract tests.

## Out Of Scope

- Redesigning the rest of the UI.
- Changing the app name or manifest metadata.
- Splash screen redesign.
- Backend, sync, auth, or push behavior changes.
- Production deployment, git push, tags, or release work.

## Acceptance Criteria

- Visible sidebar logo uses the new mark.
- PWA install icons use the new mark at existing paths and sizes.
- Favicon uses the new mark.
- Service worker cache version is bumped.
- Existing tests pass.

## Required Checks

- `node --check scripts/generate-focus-logo-assets.mjs`
- `node --check public/service-worker.js`
- `node --test tests/install-quality-css.test.mjs tests/sync-integration-assets.test.mjs tests/desktop-layout-css.test.mjs`
- `npm.cmd run test`
- `git status --short`
- `git diff --stat`
