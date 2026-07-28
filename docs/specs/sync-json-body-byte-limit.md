# Sync JSON Body Byte Limit

Status: IMPLEMENTED_LOCAL_COMMITTED

Implementation note: TASK-039 implemented and committed locally on 2026-07-28; deployment remains postponed by owner.

## Context

The backend limits JSON request bodies with `MAX_BODY_BYTES`. The current oversized-body check counts JavaScript string characters after chunk concatenation, which matches ASCII but can undercount multibyte Unicode payloads.

## Goal

Enforce the JSON body limit using incoming byte size.

## Requirements

- Count request body size from incoming chunks in bytes.
- Keep malformed JSON and empty-body behavior unchanged.
- Keep the existing `413 request_body_too_large` response contract unchanged.
- Add a focused server test with a multibyte JSON payload that exceeds the byte limit.

## Out Of Scope

- Changing the configured body size limit.
- Changing collection validation rules.
- Streaming JSON parsing.
- Production deploy, git push, tags, or release work.

## Acceptance

- ASCII oversized payloads still return `413 request_body_too_large`.
- Multibyte Unicode payloads that exceed the byte limit also return `413 request_body_too_large`.
- Existing tests pass locally.
