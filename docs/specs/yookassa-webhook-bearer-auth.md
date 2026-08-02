# YooKassa Webhook Bearer Auth

Spec id: YOOKASSA-WEBHOOK-BEARER-AUTH-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-082
Date: 2026-08-02

## Goal

Allow the YooKassa webhook endpoint to authenticate with a standard `Authorization: Bearer ...` token in addition to the existing query and custom-header token paths.

The webhook endpoint already requires a configured shared secret and compares tokens with a timing-safe check. This task adds a safer operational option for reverse proxies or provider setups that can send an authorization header, while preserving backward compatibility with the existing onboarding paths.

## Scope

- Reuse the existing Bearer token parsing logic used by admin authentication.
- Accept `Authorization: Bearer <token>` for `/api/yookassa/webhook`.
- Keep `?token=...`, `?webhookToken=...`, and `x-focus-yookassa-token` support unchanged.
- Keep method checks, replay guard, notification validation, entitlement activation, and audit logging unchanged.

## Out Of Scope

- Removing query-token support.
- Changing YooKassa payment creation or status checks.
- Adding IP allow-listing, mTLS, or provider-specific signature verification.
- Production deployment.
- Git push, tags, or release work.

## Acceptance Criteria

- Webhook requests with a valid Bearer token are accepted.
- Webhook requests without a valid token are still rejected.
- Existing webhook query-token and custom-header behavior remains compatible.
- Existing focused and full tests pass locally.
