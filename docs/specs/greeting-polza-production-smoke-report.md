# Greeting Polza.ai Production Smoke Report

Status: completed sanitized production UI smoke for Focus Greeting Assistant. No real key, bearer token, raw provider payload, provider dashboard data, or generated greeting text is included.

This record was filled only after the model comparison matrix was complete, production secrets were installed server-side, production activation was approved by the owner, and the production activation runbook was followed.

## Approval

- Smoke date: 2026-08-18.
- Owner approval reference: owner approved production Polza activation for section "Compose greeting" with model `openai/gpt-5.4-mini` on 2026-08-18, then approved continuing with production UI smoke.
- Operator: Codex.
- Approved environment: Focus production server `/opt/focus-v2`, public UI `focus-v2.dmnao83.ru`.
- Deployed source id: `e9f7231` plus the recorded 2026-08-18 runtime patches for prompt v3, strict OpenAI-compatible schema, validation retry, language-quality markers, and blocked-cliche markers.
- Selected model id: `openai/gpt-5.4-mini`.
- Model comparison record: `docs/specs/greeting-polza-model-comparison-decision-record.md`.
- Production gate flags enabled: yes.
- Secret installation method: server-only `/opt/focus-v2/data/focus-v2.env`.

Do not paste or record provider keys, bearer tokens, authorization headers, raw provider responses, provider dashboards, screenshots with secrets, or shell history containing secrets.

## Preflight

- [x] `GET /api/health` returned `{"ok":true,"service":"focus-sync"}` during activation checks.
- [x] `FOCUS_POLZA_PRODUCTION_ENABLED=true` was set only in server secrets/config.
- [x] `FOCUS_POLZA_MODEL_COMPARISON_APPROVED=true` was set only after the model comparison record was complete.
- [x] Authenticated greeting readiness returned `providerConfigured: true`.
- [x] Authenticated greeting readiness returned `provider: "polza"`.
- [x] Authenticated greeting readiness returned `readinessStatus: "ready"`.
- [x] Production preflight returned `checks.liveProviderCallPerformed: false`.
- [x] Status and readiness responses did not include model id, API key, bearer token, base URL, provider metadata, draft fields, birthday mutations, reminder fields, delivery fields, or sent-status fields.
- [x] Frontend traffic used only Focus backend greeting endpoints.
- [x] No frontend or mobile request was sent directly to `https://polza.ai/api/v1/chat/completions`.
- [x] Server production preflight at `2026-08-18T15:15:27.208Z` returned `status: "passed"`, `requestedProvider: "polza"`, `effectiveProvider: "polza"`, `activationMode: "production"`, and `clientBoundary.passed: true`.

## UI Smoke

- [x] Opened production UI at `focus-v2.dmnao83.ru`; current client asset was `/js/app.js?v=focus-20260818-pending-checkout-stale`.
- [x] Created a temporary birthday record with fictional data for the smoke path.
- [x] Opened Greeting Assistant from that birthday record.
- [x] Greeting Assistant readiness in the modal was `ready`; the controlled disabled message was not visible.
- [x] Generated three birthday variants from the UI.
- [x] Confirmed the UI reached `state: "generated"` with `variantCount: 3`.
- [x] Confirmed the editor contained generated text and copy action became enabled.
- [x] Confirmed server validation passed through the backend response path; no UI failure state appeared.
- [x] Revised one variant with an official-tone instruction.
- [x] Confirmed revised editor text changed, `variantCount: 3` remained, and no failed state appeared.
- [x] Saved the questionnaire draft from the UI.
- [x] Confirmed saved state: `state: "saved"` and status text `Анкета сохранена локально. Можно продолжить позднее.`
- [x] Confirmed no `Отправлено` status appeared; provider output did not send, copy, or mark the greeting as sent.
- [x] Deleted the temporary birthday record after the smoke and verified after reload that `Тестовый Получатель` was absent.
- [ ] Reopened Greeting Assistant and restored the saved draft: not repeated after cleanup; saved state was observed before the temporary birthday record was deleted.
- [x] Confirmed no API key, bearer token, provider base URL, provider metadata, or authorization-looking value was visible in the UI or recorded in this report.
- [x] `localStorage` direct enumeration was not available in the browser automation context; client-boundary tests and reviewed frontend code still verify that provider keys, bearer tokens, model ids, provider URLs, and provider metadata are not written by Greeting Assistant client logic.

## Result Quality

- Russian language quality: passed for the smoke; no raw text is recorded here.
- Naturalness: passed for smoke-level acceptance.
- Ban compliance: passed for the configured server validation and smoke input.
- No invented facts: passed at smoke level; the prompt used only fictional smoke facts.
- Difference between three variants: passed at UI level; three separate variant cards rendered.
- No profanity: passed; no UI or server validation failure appeared.
- Structured result validity: passed; backend accepted generated and revised results.
- Overall pass/fail: pass, with the reopen/restore substep noted as not repeated after cleanup.

## Runtime Metrics

- Generate request latency: 3108 ms observed from UI click to generated state.
- Revise request latency: 3403 ms observed from UI click to generated state after revision.
- Average latency: 3256 ms across the two UI smoke calls.
- Estimated cost per generate request: use the selected-model comparison estimate, 0.188099 RUB per request.
- Estimated cost per revise request: use the selected-model comparison estimate, 0.188099 RUB per request.
- Cost per request source: `docs/specs/greeting-polza-model-comparison-decision-record.md`.
- Provider-side errors: none observed in UI.
- Focus server errors: none observed; `focus-v2-sync.service` was active and recent `journalctl` output had no entries for the checked window.

Record only sanitized values. Do not copy raw provider payloads if they contain request ids, provider metadata, account details, authorization-looking strings, or private user data.

## Boundary Checks

- [x] No API key or token appeared in Focus UI.
- [x] No model id appeared in Focus UI.
- [x] No provider base URL appeared in Focus UI.
- [x] No API key, token, model id, provider base URL, or provider metadata was persisted in Greeting Assistant drafts.
- [x] No API key, token, model id, provider base URL, or provider metadata was recorded in this report.
- [x] Provider output did not save drafts, copy text, edit birthdays, edit holidays, create reminders, send messages, or mark greetings as sent.
- [x] Those actions happened only after explicit user action through Focus business logic.
- [x] Draft save and temporary birthday deletion happened only after explicit UI actions through Focus business logic.

## Rollback Decision

- Keep Polza enabled: yes.
- Roll back to controlled disabled state: no.
- If rollback is needed, set `FOCUS_GREETING_AI_PROVIDER=disabled`, restart the backend, and verify `providerConfigured: false` with the unavailable message and `readinessStatus: "disabled"`.
- Key rotation required: no indication from this smoke.
- Follow-up owner decision required: no immediate rollback decision required.

## Sanitized Notes

Production Polza is active for Greeting Assistant only. The tested flow was Focus frontend -> Focus backend -> server-side Polza provider -> Focus server validation -> Greeting Assistant UI. The temporary production test birthday record was removed after verification and did not reappear after page reload.
