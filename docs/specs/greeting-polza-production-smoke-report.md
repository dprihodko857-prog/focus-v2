# Greeting Polza.ai Production Smoke Report Template

Status: sanitized report template only. Do not run this smoke, install secrets, deploy, push, or make live provider calls without explicit owner approval.

Use this template only after the model comparison matrix is complete, production secrets are installed server-side, and the production activation runbook has been followed.

## Approval

- Smoke date:
- Owner approval reference:
- Operator:
- Approved environment:
- Deployed source id:
- Selected model id:
- Model comparison record:
- Secret installation method: server secrets vault or `/opt/focus-v2/data/focus-v2.env`

Do not paste or record provider keys, bearer tokens, authorization headers, raw provider responses, provider dashboards, screenshots with secrets, or shell history containing secrets.

## Preflight

- [ ] `GET /api/health` returned `{"ok":true,"service":"focus-sync"}`.
- [ ] Authenticated `GET /api/sync/greetings/status` returned `providerConfigured: true`.
- [ ] Authenticated `GET /api/sync/greetings/status` returned `provider: "polza"`.
- [ ] Status response did not include model id, API key, bearer token, base URL, provider metadata, draft fields, birthday mutations, reminder fields, delivery fields, or sent-status fields.
- [ ] Frontend and mobile traffic used only Focus backend greeting endpoints.
- [ ] No frontend or mobile request was sent directly to `https://polza.ai/api/v1/chat/completions`.

## UI Smoke

- [ ] Opened Greeting Assistant from a birthday record.
- [ ] Generated three short birthday variants.
- [ ] Confirmed the three variants were distinct.
- [ ] Confirmed generated text used only supplied facts.
- [ ] Confirmed server validation passed.
- [ ] Revised one variant with a warmer instruction.
- [ ] Confirmed revised text preserved bans and did not add invented facts.
- [ ] Saved the questionnaire draft from the UI.
- [ ] Reopened Greeting Assistant and restored the saved draft.
- [ ] Confirmed `localStorage` contained no provider key, bearer token, model id, provider URL, authorization-looking value, or provider metadata.

## Result Quality

- Russian language quality:
- Naturalness:
- Ban compliance:
- No invented facts:
- Difference between three variants:
- No profanity:
- Structured result validity:
- Overall pass/fail:

## Runtime Metrics

- Generate request latency:
- Revise request latency:
- Average latency:
- Estimated cost per generate request:
- Estimated cost per revise request:
- Cost per request source:
- Provider-side errors:
- Focus server errors:

Record only sanitized values. Do not copy raw provider payloads if they contain request ids, provider metadata, account details, authorization-looking strings, or private user data.

## Boundary Checks

- [ ] No API key or token appeared in Focus UI.
- [ ] No model id appeared in Focus UI.
- [ ] No provider base URL appeared in Focus UI.
- [ ] No API key, token, model id, provider base URL, or provider metadata was persisted in Greeting Assistant drafts.
- [ ] Provider output did not save drafts, copy text, edit birthdays, edit holidays, create reminders, send messages, or mark greetings as sent.
- [ ] Those actions happened only after explicit user action through Focus business logic.

## Rollback Decision

- Keep Polza enabled: yes/no
- Roll back to controlled disabled state: yes/no
- If rollback is needed, set `FOCUS_GREETING_AI_PROVIDER=disabled`, restart the backend, and verify `providerConfigured: false` with the unavailable message.
- Key rotation required: yes/no
- Follow-up owner decision required: yes/no

## Sanitized Notes

Write only non-secret observations here.
