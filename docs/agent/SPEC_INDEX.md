# Spec Index

Status: DRAFT

| Spec | Status | Source | Notes |
| --- | --- | --- | --- |
| PWA foundation | INFERRED | Owner conversation and implemented files | Product behavior exists but no formal approved spec file is present. |
| IndexedDB storage | INFERRED | Owner conversation and implemented files | Product behavior exists but no formal approved spec file is present. |
| Sync backend | INFERRED | Owner conversation and implemented files | Runtime behavior exists; future changes need approved scope. |
| Notifications | INFERRED | Owner conversation and implemented files | Existing behavior inferred from code/tests. |
| NOTIF-RETRY-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/notification-retry-diagnostics.md` | TASK-003 implemented and committed locally after owner approval; deployment remains a separate owner gate. |
| SYNC-ACCOUNT-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/sync-account-creation-coalescing.md` | TASK-004 coalesces concurrent first-load account creation in the sync client. |
| DIARY-PIN-STORAGE-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/diary-pin-indexeddb-cleanup.md` | TASK-005 migrates valid legacy PIN fallback storage into IndexedDB and clears stale fallback copies after successful IndexedDB reads/writes. |
| INDEXEDDB-LEGACY-CLEANUP-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/indexeddb-legacy-cleanup.md` | TASK-006 removes migrated legacy `localStorage` data keys after successful IndexedDB migration/read. |
| PUSH-EVENT-DETAILS-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/push-event-retry-details.md` | TASK-007 shows retry attempts and next retry time in the push event log when server events include those fields. |
| BACKGROUND-SYNC-GUARD-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/background-sync-push-guard.md` | TASK-008 guards fire-and-forget client sync pushes from unexpected background rejection. |
| SYNC-PUSH-SERIALIZATION-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/sync-push-serialization.md` | TASK-009 serializes same-collection client push snapshots so newer snapshots cannot be overwritten by older in-flight pushes. |
| BACKGROUND-SYNC-OFFLINE-STATUS-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/background-sync-offline-status.md` | TASK-010 surfaces expected `offline` results from background sync pushes in the app sync status. |
| SYNC-STATE-MEMORY-FALLBACK-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/sync-state-memory-fallback.md` | TASK-011 keeps sync metadata stable within the current session when `localStorage` is unavailable. |
| ONLINE-RECOVERY-SYNC-COALESCING-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/online-recovery-sync-coalescing.md` | TASK-012 coalesces repeated online recovery sync events into one in-flight pass. |
| FOCUS-BRAND-LOGO-UPDATE-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/focus-brand-logo-update.md` | TASK-013 replaces the visible and install logo assets with the owner-provided `Ф` target concept. |
| FOCUS-BRAND-ICON-CACHE-BUST-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/focus-brand-icon-cache-bust.md` | TASK-014 moves favicon, Apple touch, manifest, and notification icon references to versioned URLs. |
| WARM-GLASS-CONTRAST-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/warm-glass-contrast-pass.md` | TASK-015 improves text and row contrast on Warm Glass summary/event panels. |
| SYNC-DATA-STATUS-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/sync-data-status-panel.md` | TASK-016 adds per-collection sync status diagnostics in Settings. |
| SYNC-DISCONNECT-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/sync-disconnect-current-device.md` | TASK-017 adds a current-device disconnect action for code-based sync accounts. |
| SYNC-CODE-COPY-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/sync-code-copy-action.md` | TASK-018 adds a copy action for the current sync account code. |
| SYNC-ACCOUNT-CODE-VALIDATION-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/sync-account-code-validation.md` | TASK-019 validates typed sync account codes before switching the local device and rejects unknown accounts server-side. |
| SYNC-CURRENT-DEVICE-SERVER-DISCONNECT-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/sync-current-device-server-disconnect.md` | TASK-020 removes the current server-side device session and current-device push subscriptions during code-based disconnect. |
| SYNC-PENDING-DEVICE-DISCONNECT-RETRY-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/sync-pending-device-disconnect-retry.md` | TASK-021 queues failed current-device server cleanup and retries it on startup and online recovery. |
| SYNC-PENDING-PROFILE-UPDATE-RETRY-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/sync-pending-profile-update-retry.md` | TASK-022 queues failed sync account profile saves and retries them on startup and online recovery. |
| SYNC-PENDING-COLLECTION-PUSH-RETRY-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/sync-pending-collection-push-retry.md` | TASK-023 marks failed background collection pushes pending and retries them before remote pulls on recovery sync. |
| SYNC-ACCOUNT-SWITCH-PENDING-CLEANUP-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/sync-account-switch-pending-cleanup.md` | TASK-024 clears stale account-scoped pending queues when switching sync accounts while preserving old device cleanup retries. |
| PUSH-UNSUBSCRIBE-ON-SYNC-DISCONNECT-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/push-unsubscribe-on-sync-disconnect.md` | TASK-025 unsubscribes the local browser PushManager subscription during code-based sync disconnect. |
| ORBIT-LOGOUT-DEVICE-CLEANUP-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/orbit-logout-device-cleanup.md` | TASK-026 runs current-device cleanup and local push unsubscribe on Orbit logout before clearing local sync state. |
| SYNC-ACCOUNT-SWITCH-DEVICE-CLEANUP-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/sync-account-switch-device-cleanup.md` | TASK-027 runs previous-account current-device cleanup and local push unsubscribe before switching to another sync account. |
| ORBIT-AUTH-ACCOUNT-SWITCH-DEVICE-CLEANUP-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/orbit-auth-account-switch-device-cleanup.md` | TASK-028 runs previous-account current-device cleanup and local push unsubscribe before saving a different Orbit Auth sync account. |
| SYNC-ACCOUNT-SWITCH-DIAGNOSTICS-RESET-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/sync-account-switch-diagnostics-reset.md` | TASK-029 resets per-collection sync diagnostics when switching to a different sync account. |
| SYNC-ACCOUNT-SWITCH-PROFILE-RESET-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/sync-account-switch-profile-reset.md` | TASK-030 clears stale account profile/device UI state when manually switching to another sync account. |
| SEASONAL-MONTH-BACKGROUND-REFRESH-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/seasonal-month-background-refresh.md` | TASK-031 replaces all monthly background WebP assets with owner-provided high-resolution seasonal images. |
| SYNC-JSON-DB-CORRUPT-PRESERVATION-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/sync-json-database-corrupt-preservation.md` | TASK-032 preserves an unreadable JSON sync database instead of silently overwriting it with empty state. |
| PUSH-STATE-PRUNE-ON-REMINDER-SAVE-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/push-state-prune-on-reminder-save.md` | TASK-033 prunes stale reminder push delivery/retry/failure state when reminders are deleted or rescheduled. |
| SYNC-JSON-BODY-ERROR-HANDLING-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/sync-json-body-error-handling.md` | TASK-034 returns explicit client-error responses for malformed or oversized JSON request bodies. |
| PUSH-SUBSCRIPTION-SANITIZATION-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/push-subscription-sanitization.md` | TASK-035 stores only expected Push API subscription fields and rejects oversized subscription strings. |
| SYNC-DEVICE-SESSION-RETENTION-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/sync-device-session-retention.md` | TASK-036 bounds per-account device session history to the most recent active devices. |
| PUSH-SUBSCRIPTION-EMPTY-BUCKET-CLEANUP-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/push-subscription-empty-bucket-cleanup.md` | TASK-037 removes empty push subscription account buckets after existing unsubscribe/removal paths. |
| SYNC-DEVICE-DISCONNECT-CORS-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/sync-device-disconnect-cors.md` | TASK-038 aligns CORS preflight methods with the implemented current-device disconnect route. |
| SYNC-JSON-BODY-BYTE-LIMIT-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/sync-json-body-byte-limit.md` | TASK-039 enforces JSON request body limits by incoming byte size, including multibyte payloads. |
| PUSH-DISPATCH-BACKGROUND-ERROR-LOGGING-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/push-dispatch-background-error-logging.md` | TASK-040 logs unexpected background reminder dispatch failures without changing delivery behavior. |
| PUSH-STATE-EMPTY-BUCKET-CLEANUP-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/push-state-empty-bucket-cleanup.md` | TASK-041 removes empty push delivery/retry/failure account buckets after direct state transitions. |
| INDEXEDDB-REMINDERS-LEGACY-CLEANUP-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/indexeddb-reminders-legacy-cleanup.md` | TASK-042 migrates legacy reminders into IndexedDB and removes stale reminder localStorage data. |
| INDEXEDDB-SAVE-LEGACY-CLEANUP-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/indexeddb-save-legacy-cleanup.md` | TASK-043 removes stale fallback localStorage keys after successful IndexedDB saves. |
| LOCALSTORAGE-FALLBACK-READ-GUARD-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/localstorage-fallback-read-guard.md` | TASK-044 guards legacy fallback reads so unavailable localStorage cannot break hydration. |
| ACCOUNT-ENTITLEMENTS-FOUNDATION-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/account-entitlements-foundation.md` | TASK-045 adds backend/client account entitlements for future paid features, starting with voice transcription. |
| PAID-FEATURE-UI-SHELL-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/paid-feature-ui-shell.md` | TASK-046 adds Settings and Useful UI shells for subscription-gated voice transcription access. |
| SUBSCRIPTION-CHECKOUT-FOUNDATION-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/subscription-checkout-foundation.md` | TASK-047 adds a provider-ready checkout API/client/UI path for paid feature subscription activation. |
| PUBLIC-REQUISITES-PAGE-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/public-requisites-page.md` | TASK-048 adds a public merchant requisites page for YooKassa onboarding. |
| PUBLIC-SUBSCRIPTION-PAGE-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/public-subscription-page.md` | TASK-049 adds a public Focus Plus tariff page and links paid feature UI to price/terms. |
| PUBLIC-LEGAL-DOCUMENTS-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/public-legal-documents.md` | TASK-050 adds public offer and privacy pages for the Focus Plus subscription path. |
| VOICE-INPUT-FOUNDATION-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/voice-input-foundation.md` | TASK-051 wires browser speech recognition controls behind the `voiceTranscription` entitlement. |
| MANUAL-ENTITLEMENT-ACTIVATION-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/manual-entitlement-activation.md` | TASK-052 adds a secret-gated backend path for operator activation of paid feature access during testing. |
| YOOKASSA-WEBHOOK-SCAFFOLD-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/yookassa-webhook-scaffold.md` | TASK-053 adds a token-gated YooKassa payment succeeded webhook scaffold for future automatic entitlement activation. |
| YOOKASSA-CHECKOUT-PAYMENT-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/yookassa-checkout-payment.md` | TASK-054 creates YooKassa redirect payments from the existing checkout endpoint when provider credentials are configured. |
| YOOKASSA-RETURN-PAYMENT-STATUS-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/yookassa-return-payment-status.md` | TASK-055 checks pending YooKassa payment status after return and activates paid feature access only for paid matched payments. |
| FOCUS-PLUS-ENTITLEMENT-PERIODS-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/focus-plus-entitlement-periods.md` | TASK-056 adds activation/expiration periods and payment idempotency to paid feature entitlements. |
| ENTITLEMENT-AUDIT-LOG-001 | IMPLEMENTED_LOCAL_COMMITTED | `docs/specs/entitlement-audit-log.md` | TASK-057 records recent paid feature access events per account and exposes an entitlement diagnostics endpoint. |
| Diary PIN | INFERRED | Owner conversation and implemented files | Privacy-sensitive changes require security/privacy review. |
