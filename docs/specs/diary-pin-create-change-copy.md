# Diary PIN Create And Change Copy

## Status

IMPLEMENTED_DEPLOYED_PENDING_COMMIT

## Task

TASK-106 clarifies Diary PIN setup/change actions without changing PIN storage or verification.

## Scope

- Use "Create PIN" copy for first-time diary PIN setup instead of "Set PIN".
- Use "Change PIN" copy when an existing diary PIN is present.
- Add a secondary change-PIN action to the diary unlock modal.
- Hydrate diary PIN settings before rendering the Settings PIN summary.
- Keep the existing four-digit PIN validation, hashing, storage, unlock, and fallback cleanup behavior unchanged.

## Acceptance

- The diary unlock modal exposes a `diaryUnlockChangePinButton` action.
- First-time setup labels say `Создать PIN`.
- Existing-PIN actions say `Изменить PIN`.
- The change action opens the existing PIN form in change mode after loading current PIN settings.
- Static coverage checks the new HTML hook, copy, JS handler, and Settings hydration path.
- Focused and full regression checks pass locally.

## Out Of Scope

- PIN algorithm changes.
- Server-side diary encryption.
- Recovery code flows.
- Changing IndexedDB or legacy fallback storage contracts.
- Production deployment, git push, tags, or release work.
