# Subscription Pending Checkout Continue Link

Spec id: SUBSCRIPTION-PENDING-CHECKOUT-CONTINUE-LINK-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-079
Date: 2026-08-02

## Goal

Let the user return to an unfinished YooKassa checkout from Settings or Useful without creating another payment.

TASK-078 made pending checkout state visible and routed the main action to payment status verification. TASK-079 adds a separate continuation link when the stored pending checkout contains a safe checkout URL, so the user can either continue payment or verify payment status from the same card.

## Scope

- Render a `Продолжить оплату` link for the current account's pending checkout when a checkout URL is available.
- Show the continuation link in both Settings paid feature cards and the Useful subscription panel.
- Accept only `http` and `https` checkout URLs before rendering the link.
- Keep the main paid feature button dedicated to status verification while pending checkout exists.
- Keep backend checkout creation, payment status checks, webhook behavior, and entitlement activation unchanged.
- Bump the PWA service worker cache.

## Out Of Scope

- Creating new payment sessions.
- Clearing or expiring pending checkout records.
- Changing YooKassa payment provider behavior.
- Opening external payment pages in a custom in-app browser.
- Production deployment.
- Git push, tags, or release work.

## Acceptance Criteria

- Pending checkout with a safe URL shows `Продолжить оплату` in Settings.
- Pending checkout with a safe URL shows `Продолжить оплату` in Useful.
- Unsafe or empty checkout URLs do not render a continuation link.
- The existing `Проверить` action remains available for payment status verification.
- Existing focused and full tests pass locally.
