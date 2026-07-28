# Sync Device Disconnect CORS

Status: IMPLEMENTED_LOCAL_COMMITTED

Implementation note: TASK-038 implemented and committed locally on 2026-07-28; deployment remains postponed by owner.

## Context

The backend exposes `DELETE /api/sync/devices/current` for disconnecting the current device. Shared response headers currently advertise allowed CORS methods without `DELETE`, which can make browser preflight checks reject valid disconnect requests from an allowed web client context.

## Goal

Make the server CORS method list match the sync API methods that are actually implemented.

## Requirements

- Include `DELETE` in the shared `access-control-allow-methods` response header.
- Keep existing CORS origin/header behavior unchanged.
- Keep current-device disconnect API behavior unchanged.
- Add a focused server test for the preflight response.

## Out Of Scope

- Changing CORS origin policy.
- Adding credentials-based CORS.
- Changing auth, sync, push, or client UI behavior.
- Production deploy, git push, tags, or release work.

## Acceptance

- `OPTIONS` responses include `DELETE` in `access-control-allow-methods`.
- Existing sync device disconnect tests continue to pass.
- Existing tests pass locally.
