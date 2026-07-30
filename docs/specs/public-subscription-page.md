# Public Subscription Page

Status: IMPLEMENTED_LOCAL_COMMITTED

## Context

YooKassa verification can take several days. During verification, Focus can prepare public product information and pricing that may be needed for payment-provider review screenshots and future checkout onboarding.

## Goal

Add a public subscription/tariff page for Focus Plus and connect it from the existing subscription-gated voice transcription UI.

## Scope

- Add `public/subscription.html`.
- Show Focus Plus price as `199 ₽/мес`.
- Describe voice transcription as the first paid feature.
- Link to the public requisites page.
- Link Settings/Useful paid feature cards to the public subscription page.
- Cache the page through the service worker app shell.
- Add focused tests.

## Non-Goals

- Production deploy.
- Real YooKassa checkout.
- Webhook activation.
- Tax, invoice, refund, cancellation, or formal offer implementation.
- Actual microphone capture or speech recognition.

## Acceptance Criteria

- `public/subscription.html` opens as a standalone public HTML page.
- The page exposes the Focus Plus plan, `199 ₽` price, voice transcription service description, and requisites link.
- App paid feature cards include a visible `Условия и цена` link.
- Service worker cache includes `/subscription.html`.
- Existing focused tests pass locally.

## Verification

- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --test tests/legal-pages.test.mjs tests/sync-integration-assets.test.mjs tests/desktop-layout-css.test.mjs tests/install-quality-css.test.mjs`
- `npm.cmd run test`
