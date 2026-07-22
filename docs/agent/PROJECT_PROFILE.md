# Project Profile

Status: DRAFT

## Project

- Name: Focus v2
- Local path: focus-v2
- Repository: local Git repository initialized on 2026-07-22 with a baseline commit.
- Owner: project owner in the current Codex workspace.
- Stage: working PWA-first planner with local storage, sync backend, install assets, and notification diagnostics.
- Primary goal: provide a cross-device Focus planner experience for desktop browsers, Windows/macOS app windows, Android PWA, and iOS/iPadOS PWA.

## Product Boundaries

- In scope: planning calendar, reminders, schedules, birthdays, notes, diary, PWA install quality, sync, push notification diagnostics.
- Out of scope without owner approval: monetization, public product launch decisions, new external providers, payment flows, production data migration, final visual approval.
- Owner-controlled decisions: roadmap priority, design-system changes, auth/data/privacy choices, deployment, commit, push, and release.

## Technical Boundaries

- Architecture: static frontend under `public/` plus Node sync backend under `server/`.
- Runtime: PWA shell with service worker and web-push backend support.
- Data: browser IndexedDB/local app data plus backend account snapshots for sync.
- External services: production deployment exists at `https://focus-v2.dmnao83.ru`; changes to deployment remain owner-gated.

## Non-Negotiable Rules

- Do not invent product goals.
- Do not connect real APIs, auth, billing, or personal data without owner approval.
- Do not publish, deploy, push, or delete data without owner approval.
- Run `npm.cmd test` before reporting runtime or deployment-impacting work complete.
