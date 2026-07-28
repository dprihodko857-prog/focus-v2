# Seasonal Month Background Refresh

Status: IMPLEMENTED_LOCAL_COMMITTED

Implementation note: TASK-031 implemented and committed locally on 2026-07-28; deployment remains postponed by owner.

## Context

The owner provided a new folder of monthly background images because the current seasonal backgrounds looked too low quality. The app already uses one WebP background per month from `public/assets/months/large`.

## Goal

Replace all 12 monthly background assets with higher-resolution versions while preserving the existing file paths used by the app.

## Requirements

- Use the owner-provided PNG files from the monthly images folder as the source.
- Convert the source images to WebP and keep the existing English month filenames.
- Preserve the existing `/assets/months/large/{month}.webp` paths so CSS/JS logic does not need to change.
- Keep all monthly backgrounds at high desktop-friendly resolution.
- Bump the service worker cache for the changed PWA shell/assets.
- Add a focused asset test so future replacements do not silently regress to low-resolution images.

## Out Of Scope

- Layout redesign.
- Month image selection logic changes.
- Backend changes.
- Production deploy, git push, tags, or release work.

## Acceptance

- All 12 `public/assets/months/large/*.webp` files are replaced from the new source folder.
- The generated WebP files are `1672x941`.
- The service worker still pre-caches the same monthly asset paths.
- Existing tests pass locally.
