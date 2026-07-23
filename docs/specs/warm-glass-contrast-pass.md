# WARM-GLASS-CONTRAST-001 - Improve Warm Glass Text Contrast

Owner decision: owner reported weak text readability in the today summary panel screenshot on 2026-07-23.

## Goal

Increase text readability on Warm Glass panels while preserving the current visual direction, layout, and seasonal image background.

## Context

- The summary panel sits over bright warm seasonal imagery.
- Existing glass panels were visually soft, but some title, subtitle, and colored event text had insufficient separation from the background.
- Event titles use category colors, and those colors need to stay recognizable without becoming too light on warm backgrounds.
- The PWA service worker must be bumped when CSS changes so installed apps receive the updated visual layer.

## In Scope For TASK-015

- Darken the main text tokens used across glass panels.
- Increase glass panel opacity and border separation for summary/task cards.
- Increase row contrast inside the summary and day-card event lists.
- Render event titles with readable category colors mixed toward graphite.
- Bump the service worker cache.
- Add/update contract tests for the new contrast rules.

## Out Of Scope

- Redesigning the whole UI.
- Changing layout behavior, sidebar behavior, or mobile breakpoints.
- Changing event data, reminders, sync, auth, or backend behavior.
- Production deployment, git push, tags, or release work.

## Acceptance Criteria

- Summary text and subtitles are darker and easier to read over the seasonal background.
- Colored event titles keep category identity but are mixed toward graphite for contrast.
- Summary rows and day-card event rows have stronger glass separation from the background.
- Installed PWA clients receive the CSS update through a service worker cache bump.
- Existing tests pass.

## Required Checks

- `node --check public/js/app.js`
- `node --check public/service-worker.js`
- `node --test tests/desktop-layout-css.test.mjs tests/install-quality-css.test.mjs tests/sync-integration-assets.test.mjs`
- `npm.cmd run test`
- `git status --short`
- `git diff --stat`
