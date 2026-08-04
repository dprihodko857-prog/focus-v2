# Professional Holiday Description Polish

## Status

IMPLEMENTED_LOCAL_COMMITTED

## Task

TASK-104 improves professional holiday descriptions in readonly holiday detail cards.

## Scope

- Add a richer configured description for Builder's Day.
- Include the holiday audience, recurrence rule, current catalog year date, and traditional post-USSR country note.
- Render the recurrence rule with safe emphasis in the "About the holiday" section.
- Preserve escaped fallback descriptions for all other holiday types.
- Keep generic professional holiday fallback text for professional holidays without a configured description.
- Bump the PWA cache to `focus-pwa-v125`.

## Acceptance

- Builder's Day says it is a professional holiday for construction industry workers.
- The phrase "otmechaetsya ezhegodno vo vtoroe voskresene avgusta" is rendered with a safe `<strong>` wrapper in the detail description.
- For the 2026 catalog, Builder's Day includes the computed date text "9 avgusta".
- The description includes the traditional Belarus/Kazakhstan/other former-USSR country note.
- Non-configured professional holidays still use the existing safe generic fallback.
- Focused and full regression checks pass locally.

## Out Of Scope

- Adding encyclopedia-level descriptions for every professional holiday.
- Changing holiday catalog source dates or event metadata.
- Production deployment, git push, tags, or release work.
