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
| Diary PIN | INFERRED | Owner conversation and implemented files | Privacy-sensitive changes require security/privacy review. |
