# Past Day Calendar History

## Status

IMPLEMENTED_LOCAL_COMMITTED

## Task

TASK-103 makes past calendar day cards useful as readonly Focus history.

## Scope

- Show past calendar day cards as readonly history instead of future-oriented editable event lists.
- Build past-day history from planned Focus tasks, local reminders, schedule day-time rows, and schedule lesson rows.
- Keep future and current date cards on the existing editable event flow.
- Render history-specific labels and empty-state copy.

## Acceptance

- A past calendar date displays readonly history rows for planned Focus entities on that date.
- Past history rows sort by planned time.
- Past history rows do not expose delete controls.
- Past day empty state uses history-specific copy.
- Static coverage checks the readonly past-day history behavior.
- Focused and full regression checks pass locally.

## Out Of Scope

- Editing historical records from the day card.
- Changing storage contracts.
- Calendar layout redesign.
- Production deployment, git push, tags, or release work.
