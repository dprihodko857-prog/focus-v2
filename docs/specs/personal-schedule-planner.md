# Personal Schedule Planner

Status: local scaffold, mock AI provider.

## Purpose

The Useful section exposes "Персональный ритм дня" as the first Personal Schedule Planner feature. The user completes a step-by-step intake, Focus generates a draft, validates it deterministically, lets the user edit it, and imports it into existing Focus entities only after explicit confirmation.

## Data Flow

1. UI stores intake progress in IndexedDB under `focusPersonalSchedulePlanner`.
2. UI builds a minimized structured request with `createPersonalScheduleAiRequest()`.
3. Existing calendar data is included only after the user consents, and only as structured intervals without notes, diary text, or personal event titles.
4. Client calls `scheduleSync.generatePersonalSchedule()` against `/api/sync/personal-schedule/generate`.
5. Backend validates the account header and DTO, then calls the configured Personal Schedule provider.
6. Current provider is `mock`; no live API calls are made.
7. The returned draft is validated again before import.
8. Import writes to existing schedules, tasks, and optional reminders. Rollback removes only the imported entity ids.

## Prompt Version

`personal-schedule-planner@2026-08-04.v1`

## Provider Contract

The backend provider must expose:

```js
{
  provider: "provider-name",
  promptVersion: "personal-schedule-planner@2026-08-04.v1",
  async generate(request) {
    return {
      status: "draft_ready",
      provider: "provider-name",
      promptVersion: "personal-schedule-planner@2026-08-04.v1",
      draft
    };
  }
}
```

The provider must return structured JSON only. API keys must stay in server environment variables; no client secret is required or accepted.

## Current Limitations

- Real AI provider is not connected.
- AI revisions reuse regeneration flow; autonomous adaptation is disabled.
- History is local IndexedDB state, not a synced collection.
- No payment or production deployment is included in this task.
