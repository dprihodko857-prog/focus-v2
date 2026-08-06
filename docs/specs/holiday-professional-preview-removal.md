# Holiday Professional Preview Removal

Status: Implemented and deployed
Date: 2026-08-05

## Goal

Remove the professional holiday preview card from Holidays settings while keeping the existing professional holiday mode controls:

- `Не показывать`
- `Показывать все`
- `Выбрать направления`

## Scope

- Remove the `holidayProfessionalPreview` DOM node.
- Remove preview rendering functions and CSS.
- Keep professional category selection, category counts, and examples.
- Keep the expanded professional holiday catalog unchanged.
- Deploy as an isolated Holidays static payload without unrelated dirty worktree changes.

## Verification

- Focused static tests pass.
- Production app returns `200`.
- Production service worker is bumped to `focus-pwa-v136`.
- Production app/CSS asset URLs use `focus-20260805-holiday-no-preview-2` so existing PWA caches fetch the no-preview UI.
- Production HTML/CSS/JS no longer contains preview markers.
- Production HTML still contains the three `holidayProfessionalMode` radio values.
