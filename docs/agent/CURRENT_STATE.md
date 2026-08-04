# Current State

Status: DRAFT

## Implemented

- PWA manifest, service worker, app icons, splash assets, and install diagnostics are present.
- Main app UI includes calendar, reminders, schedules, birthdays, notes, diary, useful services entry, and settings.
- Important app data has IndexedDB-backed storage modules and sync client integration.
- Node backend under `server/sync-server.mjs` supports sync, auth endpoints, push subscriptions, reminder dispatch, and push delivery event history.
- Diary access is protected by a four digit PIN gate in the current app behavior.
- TASK-003 is implemented locally: transient reminder push failures now enter bounded retry diagnostics, and max-attempt exhaustion is visible in diagnostics/events.
- Push notification controls were hotfixed after device QA: when permission exists but the device is not subscribed, the reminders center exposes a clear `Подключить` action and allows `Тест` to register before sending.
- PWA/mobile push hardening was deployed and verified on iPhone by the owner on 2026-07-23.
- TASK-004 is implemented locally: concurrent first-load sync account creation is coalesced in the client to avoid duplicate remote accounts.
- TASK-005 is implemented locally: diary PIN settings now migrate a valid legacy fallback into IndexedDB and clear stale `localStorage` fallback copies after successful IndexedDB reads/writes.
- TASK-006 is implemented locally: legacy `localStorage` keys for important app data are removed after successful IndexedDB migration/read cleanup.
- TASK-007 is implemented locally: the push event log now shows retry attempt counts and next retry time when server events include them.
- TASK-008 is implemented locally: fire-and-forget client sync pushes are guarded from unexpected background rejection.
- TASK-009 is implemented locally: same-collection client push snapshots are serialized to avoid older in-flight pushes overwriting newer snapshots.
- TASK-010 is implemented locally: expected background sync `offline` results now show the deferred sync status instead of failing silently.
- TASK-011 is implemented locally: sync metadata has an in-memory session fallback when `localStorage` is unavailable.
- TASK-012 is implemented locally: repeated `online` events now share one in-flight recovery sync pass.
- TASK-013 is implemented locally: visible and install logo assets now use the new `Ф` target mark.
- TASK-014 is implemented locally: favicon, Apple touch, manifest, and notification icon references now use versioned `v2` URLs to bypass stale icon caches.

- TASK-015 is implemented locally: Warm Glass text, summary rows, and event title contrast were strengthened without changing the app layout.
- TASK-015 was deployed to `https://focus-v2.dmnao83.ru` on 2026-07-23 with service worker cache `focus-pwa-v53`; backend and Nginx were active after deployment.
- TASK-016 is implemented locally: Settings now includes per-collection sync status diagnostics and a manual all-collection refresh action; service worker cache is `focus-pwa-v54`.
- TASK-017 is implemented locally: Settings now includes a confirmed current-device disconnect action for code-based sync accounts; service worker cache is `focus-pwa-v55`.
- TASK-018 is implemented locally: Settings now includes a one-click sync code copy action with manual fallback; service worker cache is `focus-pwa-v56`.
- TASK-019 is implemented locally: sync and push routes reject unknown account ids, Orbit Auth creates its account explicitly, and Settings validates typed sync codes before saving them; service worker cache is `focus-pwa-v57`.
- TASK-020 is implemented locally: code-based sync disconnect removes the current server-side device session and current-device push subscriptions before clearing local sync state; service worker cache is `focus-pwa-v58`.
- TASK-021 is implemented locally: failed current-device server cleanup is queued and retried on app startup and online recovery even after local sync account clearing; service worker cache is `focus-pwa-v59`.
- TASK-022 is implemented locally: failed sync account profile saves are queued and retried on app startup and online recovery; service worker cache is `focus-pwa-v60`.
- TASK-023 is implemented locally: failed background collection pushes are marked pending and retried before remote pulls during startup/online recovery; service worker cache is `focus-pwa-v61`.
- TASK-024 is implemented locally: switching sync accounts clears stale pending profile/collection queues while preserving old device cleanup retries; service worker cache is `focus-pwa-v62`.
- TASK-025 is implemented locally: code-based sync disconnect also attempts to unsubscribe the local browser push subscription; service worker cache is `focus-pwa-v63`.
- TASK-026 is implemented locally: Orbit logout attempts current-device cleanup and local push unsubscribe before clearing local sync state; service worker cache is `focus-pwa-v64`.
- TASK-027 is implemented locally: switching to another sync account attempts previous-account current-device cleanup and local push unsubscribe before storing the new account; service worker cache is `focus-pwa-v65`.
- TASK-028 is implemented locally: Orbit Auth account switching uses the same previous-account current-device cleanup and local push unsubscribe helper; service worker cache is `focus-pwa-v66`.
- TASK-029 is implemented locally: manual sync-code and Orbit Auth account switching reset per-collection sync diagnostics after a real account change; service worker cache is `focus-pwa-v67`.
- TASK-030 is implemented locally: manual sync-code account switching clears stale account profile/device UI state before loading the new profile; service worker cache is `focus-pwa-v68`.
- TASK-031 is implemented locally: all monthly background WebP assets were regenerated from owner-provided `1672x941` seasonal PNG images; service worker cache is `focus-pwa-v69`.
- TASK-032 is implemented locally: an unreadable sync JSON database file is preserved as a unique `.corrupt-*` sibling before the backend starts with a fresh state.
- TASK-033 is implemented locally: saving a reminder snapshot prunes stale push delivery/retry/failure state for removed or rescheduled reminder keys while keeping push event history.
- TASK-034 is implemented locally: malformed or oversized JSON request bodies now return explicit `400 invalid_json` or `413 request_body_too_large` responses instead of generic server errors.
- TASK-035 is implemented locally: backend push subscription saves now store only expected Push API fields and reject oversized subscription strings.
- TASK-036 is implemented locally: sync account device session history is capped to the 12 most recent sessions while keeping the current device visible.
- TASK-037 is implemented locally: empty push subscription account buckets are deleted after the final subscription is removed by existing unsubscribe/removal paths.
- TASK-038 is implemented locally: shared CORS preflight methods now include `DELETE` for the current-device disconnect route.
- TASK-039 is implemented locally: backend JSON body limits are enforced by incoming byte size, including multibyte Unicode payloads.
- TASK-040 is implemented locally: unexpected background reminder dispatch failures are logged safely without creating unhandled promise rejections.
- TASK-041 is implemented locally: empty push retry/failure account buckets are deleted after direct delivery/retry/failure state transitions.
- TASK-042 is implemented locally: legacy reminder data now migrates into IndexedDB and stale `localReminders` legacy storage is removed after successful IndexedDB access; service worker cache is `focus-pwa-v70`.
- TASK-043 is implemented locally: successful IndexedDB saves now remove stale fallback `localStorage` keys for schedules, reminders, tasks, notes, birthdays, diary entries, and diary PIN settings; service worker cache is `focus-pwa-v71`.
- TASK-044 is implemented locally: legacy fallback reads now use guarded helpers so unavailable `localStorage` cannot break reminder, list, or diary PIN hydration; service worker cache is `focus-pwa-v72`.
- TASK-045 is implemented locally: backend/client account entitlements now support future paid features, starting with disabled-by-default `voiceTranscription`; service worker cache is `focus-pwa-v73`.
- TASK-046 is implemented locally: Settings and Useful now show subscription-gated `voiceTranscription` status from account entitlements, including no-account, offline, locked, and active UI states; service worker cache is `focus-pwa-v74`.
- TASK-047 is implemented locally: backend/client/UI now expose a provider-ready subscription checkout path for `voiceTranscription` while leaving entitlement activation to a future provider webhook/admin step; service worker cache is `focus-pwa-v75`.
- TASK-048 is implemented and deployed: a public requisites page for YooKassa onboarding is available at `https://focus-v2.dmnao83.ru/requisites.html`; service worker cache is `focus-pwa-v76`.
- TASK-049 is implemented locally: a public Focus Plus tariff page is available at `/subscription.html`, paid feature UI links to price/terms, and service worker cache is `focus-pwa-v77`.
- TASK-050 is implemented locally: public offer and privacy pages are available at `/offer.html` and `/privacy.html`, tariff page links to them, and service worker cache is `focus-pwa-v78`.
- TASK-051 is implemented locally: existing `Диктовать` buttons now route through browser SpeechRecognition behind the `voiceTranscription` entitlement, with targets for reminder, task, note, birthday note, diary, and schedule wizard fields; service worker cache is `focus-pwa-v79`.
- TASK-052 is implemented locally: backend exposes a token-gated `/api/admin/entitlements` endpoint for operator activation or deactivation of `voiceTranscription` on existing sync accounts while provider verification is pending.
- TASK-053 is implemented locally: backend exposes a token-gated `/api/yookassa/webhook` scaffold for future `payment.succeeded` entitlement activation from YooKassa payment metadata.
- TASK-054 is implemented locally: checkout can create YooKassa redirect payments when server-side shop id, secret key, and return URL are configured; payment metadata carries account and feature keys for later webhook activation.
- TASK-055 is implemented locally: the app stores pending YooKassa checkout state, backend checks current-account payment status through `/api/sync/checkout/status`, and paid matched payments can activate `voiceTranscription`; service worker cache is `focus-pwa-v80`.
- TASK-056 is implemented locally: Focus Plus entitlements now include `activatedAt`, `expiresAt`, and `paymentId`; YooKassa activations create a 30-day period by default, duplicate payment ids are idempotent, expired access is returned inactive, and UI shows active/expired period text; service worker cache is `focus-pwa-v81`.
- TASK-057 is implemented locally: backend records bounded entitlement audit events for admin and YooKassa terminal outcomes, exposes `/api/sync/entitlements/events`, and sync client exposes `getEntitlementEvents()`; service worker cache is `focus-pwa-v82`.
- TASK-058 is implemented locally: Settings now shows a compact paid feature access event history for the current sync account; service worker cache is `focus-pwa-v83`.
- TASK-059 is implemented locally: backend and sync client now have an entitlement-gated voice transcription API scaffold; valid entitled requests return provider-missing state until a real STT provider is wired; service worker cache is `focus-pwa-v84`.
- TASK-060 is implemented locally: voice controls now prefer browser SpeechRecognition and fall back to a bounded MediaRecorder audio recording path that calls the entitlement-gated transcription API scaffold; service worker cache is `focus-pwa-v85`.
- TASK-061 is implemented locally: backend/client transcription now includes account-scoped monthly usage diagnostics and quota checks; provider-missing requests do not spend quota; service worker cache is `focus-pwa-v86`.
- TASK-062 is implemented locally: Settings and Useful now show monthly `voiceTranscription` usage diagnostics from the entitlements response; service worker cache is `focus-pwa-v87`.
- TASK-063 is implemented locally: backend stores bounded processed provider event keys and ignores exact YooKassa webhook replay delivery before entitlement activation or duplicate audit logging.
- TASK-064 is implemented locally: backend transcription now has a configurable provider adapter and local `localEcho` provider for end-to-end checks; successful transcriptions spend monthly usage and provider-missing/failure paths do not.
- TASK-065 is implemented locally: backend records bounded account-scoped transcription diagnostics without storing audio or recognized text payloads.
- TASK-066 is implemented locally: Settings now shows a server transcription diagnostics journal backed by `scheduleSync.getTranscriptionEvents()`; service worker cache is `focus-pwa-v88`.
- TASK-067 is implemented locally: voice recording requests carry bounded `durationMs`, backend diagnostics store it, and Settings shows duration in the dictation journal; service worker cache is `focus-pwa-v89`.
- TASK-068 is implemented locally: Settings now shows server transcription provider readiness and limits before dictation attempts; service worker cache is `focus-pwa-v90`.
- TASK-069 is implemented locally: backend supports an env-configured OpenAI transcription provider adapter while leaving production disabled until credentials are configured; service worker cache is `focus-pwa-v91`.
- TASK-070 is implemented locally: transcription readiness diagnostics expose safe provider model metadata in Settings without exposing provider secrets; service worker cache is `focus-pwa-v92`.
- TASK-071 is implemented locally: slow OpenAI transcription provider calls are aborted by a configurable timeout, reported as `provider_timeout`, and do not spend voice transcription usage; service worker cache is `focus-pwa-v93`.
- TASK-072 is implemented locally: transcription readiness diagnostics expose safe provider timeout metadata in Settings without exposing provider secrets; service worker cache is `focus-pwa-v94`.
- TASK-073 is implemented locally: transcription diagnostics record safe provider processing time metadata and Settings shows it in the dictation journal; service worker cache is `focus-pwa-v95`.
- TASK-074 is implemented locally: server voice recording failure messages now use safe provider failure reasons such as timeout, auth, rate-limit, rejected-audio, unavailable, and empty transcription; service worker cache is `focus-pwa-v96`.
- TASK-075 is implemented locally: voice input now shows specific microphone and speech-recognition failure messages for denied permission, missing/busy microphone, network, no-speech, and aborted cases; service worker cache is `focus-pwa-v97`.
- TASK-076 is implemented locally: server recording fallback now shows the 15 second limit before/during recording and explains auto-stop before transcription; service worker cache is `focus-pwa-v98`.
- TASK-077 is implemented locally: Useful now shows server transcription readiness in the voice input subscription panel and refreshes it with transcription diagnostics; service worker cache is `focus-pwa-v99`.
- TASK-078 is implemented locally: paid feature cards now show pending YooKassa checkout state and re-check existing pending payments before creating a new checkout; service worker cache is `focus-pwa-v100`.
- TASK-079 is implemented locally: pending YooKassa checkout cards now include a safe `Продолжить оплату` link in Settings and Useful when a checkout URL is available; service worker cache is `focus-pwa-v101`.
- TASK-080 is implemented locally: subscription returns to `/?open=useful` now open Useful and show visible pending checkout status feedback when a stored checkout exists; service worker cache is `focus-pwa-v102`.
- TASK-081 is implemented locally: pending YooKassa checkout cards now include a confirmed local `Начать заново` reset action in Settings and Useful; service worker cache is `focus-pwa-v103`.
- TASK-082 is implemented locally: the YooKassa webhook endpoint now also accepts `Authorization: Bearer ...` tokens while keeping query and `x-focus-yookassa-token` authentication compatible.
- TASK-083 is implemented locally: YooKassa webhook and return-status metadata now distinguish missing feature keys from unsupported feature keys with `feature_missing` vs `feature_unknown` diagnostics.
- TASK-084 is implemented locally: YooKassa webhook and return-status activation now require terminal paid payments to match the configured amount and currency, with `amount_missing`, `amount_mismatch`, and `currency_mismatch` audit reasons.
- TASK-085 is implemented locally: YooKassa checkout-status activation now requires the provider response `payment.id` to match the requested payment id, with `payment_id_missing` and `payment_id_mismatch` audit reasons.
- TASK-086 is implemented locally: a public `/prices.html` page now shows the fixed Focus Plus price `199 ₽` for 30 calendar days, subscription/offer/requisites pages link to it, and service worker cache is `focus-pwa-v104`.
- TASK-087 is implemented and committed locally: production daily quote output is guarded against unsafe active catalog items, with audit scripts and server tests.
- TASK-088 is implemented and committed locally: daily quotes UI, cache, preferences, favorites, and sync client support are available; service worker cache was `focus-pwa-v109`.
- TASK-089 is implemented and committed locally: the RU-2026 holiday catalog adds readonly calendar events, safe server preferences, local-only religious selections, admin validation/dry-run, and tests; service worker cache was `focus-pwa-v110`.
- TASK-090 is implemented and committed locally: the topbar Focus mark now uses the calmer `brand-breathe 4.2s` animation instead of shimmer/glint, and service worker cache is `focus-pwa-v113`.
- TASK-091 is implemented and committed locally: ordinary separators now stop masked profanity matching instead of acting as masks, explicit mask characters still work, and a local production quote seed helper plus tests can summarize/import 6300 generated quotes across 14 categories.
- TASK-092 is implemented and committed locally: the main calendar grid now separates today, non-working days, secular holidays, religious holidays, and working weekends into independent semantic classes and status markers; service worker cache is `focus-pwa-v114`.
- TASK-093 is implemented and committed locally: the production quote seed import helper now has direct file-backed coverage for replacing stale generated seed records, preserving manual quotes, and deduping preserve-mode imports while the CLI default seed size remains 6300 quotes.
- TASK-094 is implemented and committed locally: duplicate system holidays now preserve merged event types and calendar metadata so combined public/religious dates keep all applicable calendar status markers; service worker cache is `focus-pwa-v115`.
- TASK-095 is implemented and verified locally: calendar semantic statuses now render as layered date-cell background bands instead of an extra status-dot row; service worker cache is `focus-pwa-v116`.
- TASK-096 is implemented and verified locally: layered calendar status backgrounds now use stronger opacity for quicker scanning while preserving the v116 background model and separate user event markers; service worker cache is `focus-pwa-v117`.
- TASK-097 is implemented and committed locally: Personal Schedule Planner is exposed in Useful with a modal scaffold, normalized planning intake, safe AI request/draft/import helpers, IndexedDB state persistence, sync client methods, account-scoped backend mock-provider routes, and PWA cache `focus-pwa-v118`.
- TASK-098 is implemented and committed locally: the Personal Schedule Planner shell is localized and polished in Useful and the modal wizard, weekday picker labels are `Пн/Вт/...`, review enum values render as Russian labels, and PWA cache is `focus-pwa-v119`.
- TASK-099 is implemented and committed locally: imported schedules from Personal Schedule Planner now use the Russian "Идеальное расписание" name in user-visible notes/details while keeping stable `personal_schedule_planner` internal source ids for tasks/reminders and rollback.
- TASK-100 is implemented and committed locally: readonly holiday detail cards opened from "Подробнее" now include an "О празднике" section, religious detail accents use the green calendar color, secular working-date accents use orange, secular non-working accents use red, working weekends remain dark, and PWA cache is `focus-pwa-v120`.
- Runtime through local commit `c975205` was deployed to `https://focus-v2.dmnao83.ru` on 2026-07-29; backend `focus-v2-sync` was active, public app returned `200`, API health returned `{"ok":true,"service":"focus-sync"}`, service worker returned `focus-pwa-v69`, and CORS preflight included `DELETE`.
- Runtime through local commit `2362d05` was deployed to `https://focus-v2.dmnao83.ru` on 2026-07-31; remote backup is `/opt/focus-v2/deploy-backups/backup-20260731-134936-pre-2362d05`; backend `focus-v2-sync` was active, public app returned `200`, API health returned `{"ok":true,"service":"focus-sync"}`, service worker returned `focus-pwa-v87`, and public requisites/subscription/privacy pages returned `200`.
- Runtime through local commit `8a2795c` was deployed to `https://focus-v2.dmnao83.ru` on 2026-08-03; remote backup is `/opt/focus-v2/deploy-backups/backup-20260803-122215-pre-8a2795c.tgz`; backend `focus-v2-sync` was active, public app, prices, subscription, offer, requisites, service worker, and API health checks passed; service worker cache is `focus-pwa-v104`.
- Runtime through local commit `eb4d600` was deployed to `https://focus-v2.dmnao83.ru` on 2026-08-04; remote backup is `/opt/focus-v2/deploy-backups/backup-20260804-113353-pre-eb4d600.tgz`; backend `focus-v2-sync` was active, public app, prices, subscription, offer, requisites, privacy, API health, quote audit, quote today API, and holiday catalog endpoints passed; service worker cache is `focus-pwa-v115`.
- Runtime through local commit `23ffea1` was deployed to `https://focus-v2.dmnao83.ru` on 2026-08-04; remote backup is `/opt/focus-v2/deploy-backups/backup-20260804-145306-pre-23ffea1.tgz`; backend `focus-v2-sync` was active, public app, prices, subscription, offer, requisites, privacy, API health, quote audit, quote today API, and holiday catalog endpoints passed; service worker cache is `focus-pwa-v116`.

## In Progress

- No Project Maestro task is currently in progress.

## Known Issues

- Git baseline was unavailable at the start of the 2026-07-22 Project Maestro cycle.
- No `docs/agent` memory existed before this cycle.
- No lint, typecheck, build, or dev-server scripts are configured in `package.json`.
- Git required adding this local path to global `safe.directory` because the sandbox-created `.git` ownership triggered Git's safety check.

## Verification Baseline

- Last checked: 2026-07-23
- Commands:
  - `git status --short`
  - `git rev-parse --show-toplevel`
  - `npm.cmd test`
- Result: Git reported that `focus-v2` was not a repository before baseline initialization.
- Current result: local Git repository exists; TASK-100 app/service-worker syntax checks passed, focused static/PWA tests passed 58/58, Playwright CLI DOM QA confirmed a visible "Успение Пресвятой Богородицы" description with green `rgb(95, 144, 115)` detail stripe, `npm.cmd run test` passed locally, and `git diff --check` passed on 2026-08-04. Latest production deploy on 2026-08-04 uploaded runtime through commit `23ffea1`; app, API health, service worker `focus-pwa-v116`, quote catalog audit, quote today API, holiday catalog endpoints, prices, subscription, offer, privacy, and requisites checks passed; backend service is active.

## Open Questions

- The next product/runtime task is choosing/wiring a real STT provider after credentials are available, continuing paid-feature UX, or adding deeper YooKassa webhook authenticity controls once provider settings are available.
- Future backend/deployment changes still require a separate owner deployment approval.
