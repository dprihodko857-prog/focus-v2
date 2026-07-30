# Manual Entitlement Activation

Status: IMPLEMENTED_LOCAL_COMMITTED

## Context

`voiceTranscription` is gated by account entitlements, but the payment provider review can take time. The project needs a controlled operator path to activate or deactivate access for a real sync account during internal testing, without exposing a secret in the browser app and without pretending payment has completed.

## Scope

- Add an admin-only backend endpoint for changing account entitlements.
- Keep the endpoint disabled unless `FOCUS_ADMIN_TOKEN` is configured.
- Require either `x-focus-admin-token` or `Authorization: Bearer <token>`.
- Accept only existing sync accounts.
- Accept only known paid feature keys, starting with `voiceTranscription`.
- Support enabling and disabling the feature.
- Keep the public client UI unchanged.

## Out Of Scope

- YooKassa API integration.
- Payment webhooks.
- Automatic entitlement activation after payment.
- Storing admin secrets in frontend code.
- Public admin UI.
- Production deploy, git push, tags, or release work.

## Behavior

- Without `FOCUS_ADMIN_TOKEN`, `/api/admin/entitlements` returns `404 not_found`.
- With `FOCUS_ADMIN_TOKEN`, requests without the matching admin token return `401 admin_token_required`.
- Valid requests update the account entitlement and return the normalized entitlement state.
- Disabled entitlements normalize back to `{ enabled: false, source: "none", updatedAt: null }`.
- Existing `GET /api/sync/entitlements` remains the public read path used by the app.

## Operator Example

```powershell
curl.exe -X POST "https://focus-v2.dmnao83.ru/api/admin/entitlements" `
  -H "content-type: application/json" `
  -H "x-focus-admin-token: <FOCUS_ADMIN_TOKEN>" `
  -d "{\"accountId\":\"<sync-account-id>\",\"featureKey\":\"voiceTranscription\",\"enabled\":true,\"source\":\"manual\"}"
```

## Verification

- `node --check server/sync-server.mjs`
- `node --test tests/focus-sync-server.test.mjs`
- `npm.cmd run test`
- `git diff --check`

## Result

TASK-052 adds a secret-gated backend entitlement activation path for internal testing while provider verification is pending. No app shell files changed, so the service worker cache stays `focus-pwa-v79`.
