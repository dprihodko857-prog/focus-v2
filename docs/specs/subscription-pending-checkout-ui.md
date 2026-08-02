# Subscription Pending Checkout UI

Spec id: SUBSCRIPTION-PENDING-CHECKOUT-UI-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-078
Date: 2026-08-02

## Goal

Make an unfinished YooKassa checkout visible in the paid feature UI and let the user re-check it before creating another payment.

The sync client already stores a pending YooKassa checkout after payment creation and verifies it on startup/online recovery. Before TASK-078, the Settings and Useful subscription cards could still look like a fresh `Оформить` action while a pending payment existed. This task makes that pending state explicit and routes the action to payment status verification first.

## Scope

- Detect the current account's pending `voiceTranscription` checkout from the sync client.
- Show pending, checking, canceled, invalid-payment, and ready checkout states in paid feature cards.
- Route the paid feature action through pending checkout verification when a pending payment exists.
- Keep checkout creation, YooKassa status backend, webhook, entitlement activation, and payment storage unchanged.
- Bump the PWA service worker cache.

## Out Of Scope

- Creating new payment provider endpoints.
- Changing YooKassa payment creation or webhook behavior.
- Implementing recurring billing, refunds, receipts, or cancellation management.
- Production deployment.
- Git push, tags, or release work.

## Acceptance Criteria

- If a pending YooKassa checkout exists for the current account and feature, Settings/Useful show a pending payment state.
- Pressing the paid feature action with a pending checkout checks payment status instead of creating a new checkout.
- During status verification, the action is disabled and shows a checking state.
- Terminal failed/canceled/invalid payment states are visible and allow a new checkout attempt.
- Existing focused and full tests pass locally.
