# Subscription Pending Checkout Reset

Spec id: SUBSCRIPTION-PENDING-CHECKOUT-RESET-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-081
Date: 2026-08-02

## Goal

Let the user recover from a stale or abandoned pending YooKassa checkout without waiting for provider state changes.

The app already stores a pending checkout, can re-check its status, can reopen a safe checkout URL, and opens Useful on the subscription return path. A remaining recovery gap is an old pending checkout that the user no longer wants to continue. This task adds a local reset action so the user can create a fresh checkout.

## Scope

- Show a `Начать заново` action when a pending checkout exists for the current paid feature and account.
- Show the action in both Settings paid feature cards and the Useful subscription panel.
- Confirm before clearing the local pending checkout record.
- Clear only the local pending checkout marker through the sync client.
- Return the paid feature UI to the normal checkout-ready state after clearing.
- Bump the PWA service worker cache.

## Out Of Scope

- Canceling a payment in YooKassa.
- Refunding, voiding, or expiring provider-side payments.
- Changing webhook behavior or entitlement activation rules.
- Production deployment.
- Git push, tags, or release work.

## Acceptance Criteria

- Pending checkout cards show a local `Начать заново` reset action.
- The reset action asks for confirmation before clearing local state.
- Confirmed reset removes the pending checkout from local storage.
- After reset, the paid feature action can create a new checkout.
- Existing focused and full tests pass locally.
