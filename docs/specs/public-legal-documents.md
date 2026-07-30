# Public Legal Documents

Status: IMPLEMENTED_LOCAL_COMMITTED

## Context

YooKassa verification is pending. While the provider reviews the shop, Focus can prepare public legal/supporting pages that are independent from provider secrets and webhook setup.

## Goal

Add public offer and privacy pages for the Focus Plus subscription path, and connect them from the tariff page.

## Scope

- Add `public/offer.html`.
- Add `public/privacy.html`.
- Link offer and privacy pages from `public/subscription.html`.
- Cache the pages through the service worker app shell.
- Add focused static page tests.

## Non-Goals

- Production deploy.
- Legal guarantee that the text is sufficient for all business cases.
- YooKassa API, real checkout, receipts, webhook signatures, or entitlement activation.
- Actual voice transcription implementation.

## Acceptance Criteria

- Offer page includes service, price, payment activation, and refund/cancellation sections.
- Privacy page describes data processing for planning data, sync, push, payment statuses, and future transcription.
- Subscription page links to offer, privacy, and requisites.
- Service worker cache includes `/offer.html` and `/privacy.html`.
- Existing focused tests pass locally.

## Verification

- `node --check public/service-worker.js`
- `node --test tests/legal-pages.test.mjs tests/sync-integration-assets.test.mjs tests/desktop-layout-css.test.mjs tests/install-quality-css.test.mjs`
- `npm.cmd run test`
