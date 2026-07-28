# Sync JSON Body Error Handling

Status: IMPLEMENTED_LOCAL_COMMITTED

Implementation note: TASK-034 implemented and committed locally on 2026-07-28; deployment remains postponed by owner.

## Context

Several backend API routes parse request bodies as JSON. Malformed or oversized JSON bodies are client request errors, but the shared route error handler can currently report them as generic server failures.

## Goal

Return clear HTTP client-error responses for malformed or oversized JSON request bodies.

## Requirements

- Return `400` with `invalid_json` for malformed JSON bodies.
- Return `413` with `request_body_too_large` when the request body exceeds the configured backend limit.
- Keep existing route-level validation responses unchanged, such as `invalid_schedules`.
- Keep real unexpected backend errors as `500 sync_server_error`.
- Add focused server tests for malformed and oversized request bodies.

## Out Of Scope

- Changing the request body size limit.
- Changing API payload schemas.
- Client UI changes.
- Production deploy, git push, tags, or release work.

## Acceptance

- Malformed JSON on a sync route returns `400 invalid_json`.
- Oversized JSON on a sync route returns `413 request_body_too_large`.
- Valid JSON requests continue to work.
- Existing tests pass locally.
