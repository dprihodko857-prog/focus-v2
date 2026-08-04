# Owner Decisions

| Date | Decision | Status | Notes |
| --- | --- | --- | --- |
| 2026-07-22 | Approve Project Maestro option A. | APPROVED | Scope: local backup, `.gitignore`, `docs/agent` memory, local Git init, tests, first baseline commit preparation. No push or deployment. |
| 2026-07-22 | Approve TASK-002 spec planning for notification hardening. | APPROVED | Scope: docs/spec planning only. No runtime implementation, deployment, new external service, or commit without separate approval. |
| 2026-07-22 | Approve TASK-003 bounded notification retry diagnostics runtime implementation. | APPROVED | Scope: server retry metadata and focused tests per NOTIF-RETRY-001. No deployment, backend restart, new dependencies, external live push testing, push, or commit without separate approval. |
| 2026-07-22 | Approve local commit for TASK-003. | APPROVED | Commit message: `feat: add notification retry diagnostics`. No push or deployment. |
| 2026-07-22 | Approve TASK-003 deployment to `focus-v2.dmnao83.ru`. | APPROVED | Scope: upload files, restart backend, verify status. No git push. |
| 2026-07-22 | Approve push-controls hotfix commit and deployment. | APPROVED | Commit message: `fix: clarify push subscription actions`. Scope: reminders push button UX, PWA cache bump, static deploy. No git push. |
| 2026-07-23 | Continue autonomously after iOS PWA/push verification. | APPROVED | Scope interpreted as local continuation on the next bounded project task. No git push or production deployment without separate confirmation. |
| 2026-07-23 | Approve deployment of current Focus v2 visual updates. | APPROVED | Scope: deploy current local commit `45ae1c1` to `focus-v2.dmnao83.ru`, restart backend, verify status. No git push. |
| 2026-07-29 | Approve deployment of current Focus v2 runtime. | APPROVED | Scope: deploy local runtime through commit `c975205` to `focus-v2.dmnao83.ru`, upload app/backend files, restart backend, verify status. No git push. |
| 2026-07-31 | Approve deployment of current Focus v2 runtime. | APPROVED | Scope: deploy local runtime through commit `2362d05` to `focus-v2.dmnao83.ru`, upload app/backend/package files, restart backend, fix static permissions, verify public app and API status. No git push. |
| 2026-08-04 | Approve deployment of checked Focus v2 calendar runtime. | APPROVED | Scope: deploy verified local commit `eb4d600` to `focus-v2.dmnao83.ru`, restart backend, verify status, and keep later uncommitted calendar-gradient working tree edits out of production. No git push. |
| 2026-08-04 | Approve deployment of checked Focus v2 calendar background runtime. | APPROVED | Scope: deploy verified local commit `23ffea1` to `focus-v2.dmnao83.ru`, restart backend, verify status, and keep git push out of scope. |
| 2026-08-04 | Approve deployment of Personal Schedule Planner runtime. | APPROVED | Scope: deploy exact local commit `099f981` to `focus-v2.dmnao83.ru`, restart backend, verify status, keep later local TASK-100/TASK-101 commits out of production, and keep git push out of scope. |
