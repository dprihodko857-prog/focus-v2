# Holiday Detail Description And Accent

## Status

IMPLEMENTED_LOCAL_COMMITTED

## Task

TASK-100 enriches readonly holiday detail cards opened from the day card.

## Scope

- Add an "О празднике" section to the holiday detail modal.
- Prefer explicit catalog descriptions when present, then use known holiday descriptions, then a safe type-based fallback.
- Align the holiday detail side accent with calendar semantic colors:
  - religious holidays use `--calendar-religious-holiday`;
  - secular holidays on non-working dates use `--calendar-non-working-day`;
  - secular holidays on working dates use `--calendar-secular-holiday`;
  - working weekends keep `--calendar-working-weekend`.
- Preserve readonly system-event behavior and existing source/status metadata.
- Bump the PWA cache to `focus-pwa-v120`.

## Acceptance

- Opening "Подробнее" for "Успение Пресвятой Богородицы" shows an "О празднике" description.
- The detail card side stripe for "Успение Пресвятой Богородицы" computes to the green religious color.
- Secular holiday detail accents follow the red/orange non-working vs working-date split.
- Existing holiday catalog settings, day cards, and readonly detail modal contracts remain covered by static tests.
- Focused and full regression checks pass locally.

## Out Of Scope

- Changing holiday source data, server APIs, or religious preference storage.
- Adding a full encyclopedia of all possible holidays.
- Production deployment, git push, tags, or release work.
