# Personal Schedule Overlap Guard

## Status

IMPLEMENTED_LOCAL_COMMITTED

## Task

TASK-101 hardens Personal Schedule Planner generated drafts against overlapping blocks.

## Scope

- Detect overlaps between generated blocks inside the same draft, not only conflicts with pre-existing fixed calendar intervals.
- Report generated block overlaps as blocking `draft_overlap` conflicts.
- Normalize weekday values before generated-block overlap checks so numeric and Russian weekday-label inputs are handled consistently.
- Move the primary generated focus block away from a fixed work window when the deterministic engine would otherwise place it inside the work interval.
- Bump the PWA cache to `focus-pwa-v121`.

## Acceptance

- The default quick deterministic variant has no overlapping blocks.
- A draft with overlapping generated blocks fails validation with `draft_overlap`.
- The overlap validator handles a generated block whose weekday is a Russian label.
- Existing import, rollback, AI request, and static PWA contracts keep passing.
- Focused and full regression checks pass locally.

## Out Of Scope

- Live AI provider routing or prompt changes.
- UI redesign of the planner modal.
- Backend API contract changes.
- Production deployment, git push, tags, or release work.
