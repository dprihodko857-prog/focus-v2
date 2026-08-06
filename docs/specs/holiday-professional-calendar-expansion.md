# Holiday Professional Calendar Expansion

## Status

Implemented locally, pending commit.

## Context

The RU-2026 holiday catalog originally shipped with a small professional-holiday seed. The owner noticed that military dates such as Navy Day and Airborne Forces Day were missing and asked to continue work only inside the Holidays section for this chat.

## Requirements

- Add a dedicated professional category for military service and force/security agencies.
- Expand the RU-2026 professional calendar beyond the initial seed with federal professional, sector, sport, cultural, legal, transport, industrial, medical, education, and security dates.
- Include military and Armed Forces dates such as Navy Day, Airborne Forces Day, Air Defense Troops Day, Ground Forces Day, Space Forces Day, Tankman Day, and Strategic Missile Forces Day.
- Use a dedicated source for Russian Armed Forces professional holidays and memorial days based on Presidential Decree No. 549.
- Preserve existing holiday preference modes: none, all, and selected categories.
- Keep military memorial days visible through the professional calendar while labeling them as memorial days in readonly details.
- Extend holiday detail descriptions so every new professional-calendar event has audience and recurrence copy.
- Bump the PWA service worker cache to `focus-pwa-v129`.

## Non-Goals

- Add regional holidays or region-specific non-working days.
- Add a separate military calendar surface outside the existing professional-holiday settings.
- Change public holiday, religious holiday, or user-created event editing behavior.
- Deploy to production without owner approval.

## Verification

- `node --check public/js/holiday-catalog.js`
- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --check tests/holiday-catalog.test.mjs`
- `node --check tests/sync-integration-assets.test.mjs`
- focused holiday/PWA static tests passed 70/70
- `npm.cmd run test` passed 253/253
- professional coverage script found 119 `professionalEvent(...)` titles, 28 military-source events, and 0 missing descriptions
- `git diff --ignore-cr-at-eol --check` passed with LF-to-CRLF warnings only
