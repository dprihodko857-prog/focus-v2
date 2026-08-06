# Personal Schedule Draft Overview And Quick Edits

## Status

IMPLEMENTED_DEPLOYED_PENDING_COMMIT

## Task

TASK-109 improves the "Персональный ритм дня" draft review screen with a scannable day overview and quick block-edit actions.

## Scope

- Add compact draft metrics for total planned time, goal blocks, rest time, and fixed blocks.
- Add a grouped day overview for the selected variant so the user can scan the generated rhythm before importing.
- Add quick edit actions for generated blocks: move 15 minutes earlier/later, shorten/lengthen by 15 minutes, toggle fixed time, and remove a block.
- Keep the existing direct input editor for precise time/title edits.
- Revalidate the selected variant against existing Focus intervals after quick edits.
- Keep generation, import, rollback, source ids, storage keys, and backend routes unchanged.
- Bump the PWA service worker cache to `focus-pwa-v128`.

## Acceptance

- The draft screen renders a `personal-schedule-draft-overview` section.
- The draft screen renders grouped `personal-schedule-day-preview` day cards.
- Block rows expose `data-ps-block-action` controls for `earlier`, `later`, `shorter`, `longer`, `toggle-fixed`, and `remove`.
- Quick edits update only the selected draft variant and call the same validation path before import.
- Static coverage guards the overview, quick edit controls, CSS hooks, and service worker cache.
- Focused and full regression checks pass locally.

## Out Of Scope

- Changing the deterministic generator or AI provider request contract.
- Changing imported Focus entity schema.
- Creating a separate calendar surface for this feature.
- Git push, tags, or release work.
