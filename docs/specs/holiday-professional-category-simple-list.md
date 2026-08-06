# Holiday Professional Category Simple List

Status: Implemented locally
Date: 2026-08-05

## Goal

Return the professional holiday direction selector to a simple checklist.

## Scope

- Keep the three professional modes: `Не показывать`, `Показывать все`, `Выбрать направления`.
- Render professional directions as plain checkbox rows with the direction title only.
- Allow entering `Выбрать направления` before the first category is checked.
- Remove category count chips and example holiday copy from the selector.
- Remove the nested category-list scroll area.
- Keep the expanded professional holiday catalog unchanged.

## Verification

- Focused static tests pass locally.
- The category grid has one column and no fixed internal scroll height.
- Clicking `Выбрать направления` keeps that mode active and enables the checklist even when no category is selected yet.
- The app shell no longer contains category count/example UI hooks.
- No deployment is performed.

## Follow-up

- 2026-08-05: TASK-118 cache-busted the local app/CSS URLs to `focus-20260805-holiday-simple-categories-3`, bumped local PWA cache to `focus-pwa-v141`, and browser-verified that clicking `selected` enables all 19 category checkboxes.
