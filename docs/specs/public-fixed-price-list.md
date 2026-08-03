# Public Fixed Price List

Spec id: PUBLIC-FIXED-PRICE-LIST-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-086
Date: 2026-08-03

## Context

YooKassa review requested fixed prices on the public site instead of approximate wording such as "от 100 ₽". Focus already had a public subscription page with the Focus Plus price, but provider review benefits from a separate unambiguous price-list page and direct links from legal/onboarding pages.

## Goal

Publish a public price-list page with a fixed Focus Plus price that can be sent to YooKassa during merchant review.

## Scope

- Add `public/prices.html`.
- Show one fixed service row: Focus Plus, voice transcription/dictation feature, 30 calendar days, `199 ₽`.
- Explicitly state that the price is fixed and not an "от" price.
- Link the price list from subscription, offer, and requisites pages.
- Cache `/prices.html` through the service worker app shell.
- Bump the service worker cache to `focus-pwa-v104`.
- Add focused tests for the new page and fixed-price wording.

## Out Of Scope

- Changing the actual Focus Plus tariff amount.
- Adding multiple plans, discounts, receipts, taxes, or invoice generation.
- Production deployment.
- Git push, tags, or release work.

## Acceptance Criteria

- `/prices.html` is a standalone public HTML page.
- The page contains `Тариф Focus Plus`, `199 ₽`, and `30 календарных дней`.
- The page does not contain approximate price wording such as `от 199 ₽`.
- Subscription, offer, and requisites pages link to `/prices.html`.
- Service worker cache includes `/prices.html`.
- Existing focused and full tests pass locally.
