# Subscription Return Useful Launch

Spec id: SUBSCRIPTION-RETURN-USEFUL-LAUNCH-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-080
Date: 2026-08-02

## Goal

Make the public subscription return path open the Useful section and show a clear payment status when a pending checkout exists.

The public Focus Plus page links back to the PWA with `/?open=useful`. Before this task, `useful` was not part of the allowed initial launch targets, so returning from the subscription flow could leave the user on the default screen without the paid feature context.

## Scope

- Allow `useful` as an initial launch target.
- Capture the initial launch target once during startup before the URL is cleaned.
- Open the Useful modal after local hydration when the app starts with `?open=useful`.
- If the app starts with `?open=useful` and a pending subscription checkout exists, run the pending checkout status check in visible mode so the user gets a clear status message.
- Keep normal startup pending checkout checks silent for all other launch paths.
- Bump the PWA service worker cache.

## Out Of Scope

- Changing public subscription page copy or price.
- Creating, canceling, expiring, or clearing YooKassa payments.
- Changing webhook behavior or entitlement activation rules.
- Production deployment.
- Git push, tags, or release work.

## Acceptance Criteria

- `/?open=useful` opens the Useful modal after app hydration.
- Payment return through `/?open=useful` checks an existing pending checkout with visible feedback.
- Startup without `?open=useful` keeps pending checkout checks silent.
- Existing focused and full tests pass locally.
