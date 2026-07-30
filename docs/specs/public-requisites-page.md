# Public Requisites Page

Status: IMPLEMENTED_LOCAL_COMMITTED

## Context

YooKassa onboarding asks for a public page with merchant requisites. The current Focus PWA is the product URL, but it did not expose a standalone public legal details page that a payment-provider reviewer can open without signing in.

## Goal

Add a public static requisites page for Focus with the merchant legal details required for YooKassa review.

## Scope

- Add `public/requisites.html`.
- Include merchant name, INN, OGRNIP, legal/factual address, bank details, and contacts from the owner-provided requisites.
- Keep the page independent from app state, auth, IndexedDB, and sync.
- Cache the page through the service worker app shell.
- Add focused asset tests.

## Non-Goals

- Production deploy.
- Payment provider API integration.
- Offer, privacy policy, refund policy, or subscription terms.
- Changing the main app dashboard layout.

## Acceptance Criteria

- `https://focus-v2.dmnao83.ru/requisites.html` will be the target URL after deploy.
- Page opens as a standalone public HTML document.
- INN and OGRNIP are visible in page text.
- Page does not execute app JavaScript.
- Existing focused tests pass locally.

## Verification

- `node --check public/service-worker.js`
- `node --test tests/legal-pages.test.mjs tests/sync-integration-assets.test.mjs tests/desktop-layout-css.test.mjs tests/install-quality-css.test.mjs`
- `npm.cmd run test`
