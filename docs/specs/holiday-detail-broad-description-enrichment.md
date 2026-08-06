# Holiday Detail Broad Description Enrichment

## Status

IMPLEMENTED_LOCAL_PENDING_COMMIT

## Task

TASK-108 broadens readonly holiday detail descriptions beyond the first Builder's Day polish.

## Scope

- Add configured audience and recurrence metadata for every RU-2026 professional holiday in the bundled catalog.
- Keep the Builder's Day country note and add specific notes where a professional date is also a wider commemorative date.
- Build holiday descriptions from safe escaped parts, allowing only controlled `<strong>` emphasis for recurrence/date-rule text.
- Append date-rule, 2026 occurrence date, related transfer date, and day-status context to public, religious, transfer, and fallback descriptions.
- Preserve existing catalog metadata, day-card colors, readonly behavior, and holiday selection settings.
- Bump the combined local PWA cache to `focus-pwa-v127`.

## Acceptance

- Every `professionalEvent(...)` in `public/js/holiday-catalog.js` has configured audience/recurrence copy.
- Professional detail text follows the Builder's Day pattern: what it is, who it is for, highlighted recurrence, 2026 date, and day-off clarification.
- Public/religious/transfer descriptions also include structured timing/status context instead of only generic copy.
- Dynamic description text remains escaped; only controlled recurrence parts render as `<strong>`.
- Focused and full regression checks pass locally.

## Out Of Scope

- Changing holiday catalog dates or official source metadata.
- Adding a full external encyclopedia for every holiday.
- Production deployment, git push, tags, or release work.
