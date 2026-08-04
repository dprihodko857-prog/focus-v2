# Pending Checkout Timestamp UX

## Status

IMPLEMENTED_LOCAL_COMMITTED

## Task

TASK-105 improves paid-feature pending checkout clarity in Settings and Useful.

## Scope

- Reuse the existing pending subscription checkout `createdAt` value saved by the sync client.
- Render a compact "payment created" timestamp beside pending checkout continuation/reset actions.
- Show the timestamp in both Settings paid-feature cards and the Useful subscription panel.
- Keep missing `createdAt` silent instead of rendering an empty note.
- Bump the PWA cache to `focus-pwa-v125`.

## Acceptance

- A stored pending YooKassa checkout with `createdAt` displays its creation time in Settings.
- The Useful subscription panel displays the same creation time.
- Pending checkout links and reset actions keep their existing behavior.
- Static coverage checks the helper, copy, CSS hook, and service worker cache version.
- Focused and full regression checks pass locally.

## Out Of Scope

- Live YooKassa API work.
- Payment expiration policy.
- Payment cancellation.
- Backend API contract changes.
- Production deployment, git push, tags, or release work.
