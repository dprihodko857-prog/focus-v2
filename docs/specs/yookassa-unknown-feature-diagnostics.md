# YooKassa Unknown Feature Diagnostics

Spec id: YOOKASSA-UNKNOWN-FEATURE-DIAGNOSTICS-001
Status: IMPLEMENTED_LOCAL_COMMITTED
Task: TASK-083
Date: 2026-08-02

## Goal

Report unknown paid feature metadata from YooKassa as `feature_unknown` instead of treating it as missing metadata.

Focus currently has one paid feature, `voiceTranscription`. If a YooKassa webhook or return-status response carries a future, misspelled, or unsupported feature key, the backend should ignore it safely and leave entitlement activation unchanged, while making the diagnostic reason precise enough to debug provider metadata.

## Scope

- Preserve raw YooKassa feature metadata while still normalizing to known Focus paid feature keys.
- Return and audit `feature_missing` when no feature metadata is present.
- Return and audit `feature_unknown` when feature metadata is present but unsupported.
- Apply the distinction to both webhook notifications and checkout status checks.
- Keep successful activation, payment idempotency, replay guard, and provider authentication unchanged.

## Out Of Scope

- Adding new paid features.
- Accepting arbitrary feature keys.
- Changing YooKassa payment creation metadata.
- Changing client UI labels.
- Production deployment.
- Git push, tags, or release work.

## Acceptance Criteria

- Unknown webhook feature metadata returns `ignored` with `feature_unknown`.
- Unknown checkout-status feature metadata returns `ignored` with `feature_unknown`.
- Unknown feature metadata does not activate `voiceTranscription`.
- Missing feature metadata keeps the existing `feature_missing` reason.
- Existing focused and full tests pass locally.
