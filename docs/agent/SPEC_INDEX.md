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
| Diary PIN | INFERRED | Owner conversation and implemented files | Privacy-sensitive changes require security/privacy review. |
