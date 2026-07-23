# Sync Account Code Validation

Status: IMPLEMENTED_LOCAL

## Problem

The sync backend previously accepted any valid-looking `x-focus-account` value and created an account during profile, sync, or push requests. A mistyped sync code could therefore become a new empty account instead of being rejected.

## Goal

Require sync account codes to exist before a device can connect to them, while keeping explicit new-account creation unchanged.

## Scope

- Keep `POST /api/sync/accounts` as the only code-account creation endpoint.
- Create Orbit Auth accounts explicitly when the OAuth callback succeeds.
- Return `404 { "error": "account_not_found" }` when sync or push routes receive an unknown account id.
- Let the client validate a typed sync account code before writing it into local sync settings.
- Preserve the current local sync account if validation fails.
- Bump the PWA service worker cache for the changed client shell.

## Acceptance Criteria

- Unknown account ids are rejected by sync routes and do not create snapshots/accounts.
- Existing code-account sync and push routes continue to work after the account is explicitly created.
- Orbit Auth login still produces a usable local account.
- Settings connection flow shows separate statuses for invalid, missing, and offline/unverified codes.
- Existing sync, push, install, and storage tests pass.

## Out Of Scope

- QR-code pairing.
- Human-readable short pairing codes.
- Account deletion or server-side device removal.
- Deployment, git push, tags, or production release.
