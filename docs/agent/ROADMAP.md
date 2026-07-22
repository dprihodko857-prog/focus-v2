# Roadmap

Status: DRAFT

## Current Milestone

- Name: Project baseline and controlled continuation
- Goal: create a safe local Git baseline and Project Maestro memory before selecting more runtime work.
- Owner approval: option A approved in chat on 2026-07-22.

## Milestones

| ID | Name | Goal | Status | Owner decision |
| --- | --- | --- | --- | --- |
| M-001 | PWA foundation | Manifest, icons, splash assets, service worker, offline shell | DONE | Previously requested by owner |
| M-002 | IndexedDB storage | Move important local data out of direct localStorage usage | DONE | Previously requested by owner |
| M-003 | Install quality | Desktop, Android, iOS/iPadOS, standalone, compact-window layout checks | PARTIALLY_VERIFIED | Owner reported device visuals looked good |
| M-004 | Sync | Backend, accounts, database, multiple devices | IN_PROGRESS | Previously requested by owner |
| M-005 | Notifications | Local reminders first, reliable push with backend hardening | IN_PROGRESS | Previously requested by owner |
| M-006 | Project Maestro baseline | Git baseline and `docs/agent` memory | DONE | Approved by owner on 2026-07-22 |

## Notes

- Do not add major roadmap direction without owner approval.
- Product/runtime tasks require an approved spec reference or explicit owner exception before `READY`.
