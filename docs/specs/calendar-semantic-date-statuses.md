# Calendar Semantic Date Statuses

## Context

TASK-089 added holiday catalog events to the calendar, but the month grid still relied on generic marker dots and weekend coloring. That made distinct states harder to scan: today, official non-working days, secular holidays, religious holidays, and official working weekends could visually compete with user event markers.

## In Scope

- Add calendar-specific color tokens for today, non-working days, secular holidays, religious holidays, and working weekends.
- Render semantic day-cell classes from selected holiday events.
- Keep user event markers separate from holiday status markers.
- Add accessible day labels that include the semantic status names.
- Bump the service worker cache to `focus-pwa-v114`.
- Cover the contract with static tests.

## Out Of Scope

- Changing holiday catalog data or server APIs.
- Changing holiday preferences or modal behavior.
- Redesigning the full calendar layout.
- Production deployment, git push, tags, or release work.

## Acceptance

- Today has its own date-number treatment independent from holiday/weekend color.
- Official non-working days use the non-working token.
- Secular and religious holidays render independent status dots.
- Official working weekends render a compact working-day marker.
- Legacy user event markers no longer receive holiday colors.
- `node --check public/js/app.js`, focused static tests, and full test suite pass locally.
