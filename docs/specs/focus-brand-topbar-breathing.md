# Focus Brand Topbar Breathing

## Scope

The topbar Focus mark should feel alive without using a bright sweeping glint. Replace the previous shimmer/glint animation with a restrained breathing scale and shadow pulse.

## In Scope

- Replace `brand-shimmer` and `brand-glint` with `brand-breathe 4.2s ease-in-out infinite`.
- Remove the animated pseudo-element glint from `.brand-mark--topbar`.
- Keep `prefers-reduced-motion: reduce` disabling the animation.
- Bump the PWA service worker cache to `focus-pwa-v113` so the CSS update is picked up.
- Update static CSS/PWA contract tests.

## Out Of Scope

- Changing logo geometry or icon assets.
- Redesigning the topbar, menu, or seasonal background system.
- Production deploy, push, or release work.

## Verification

- `node --check public/service-worker.js`
- `node --test tests/desktop-layout-css.test.mjs tests/install-quality-css.test.mjs tests/legal-pages.test.mjs tests/sync-integration-assets.test.mjs`
- `npm.cmd run test`
- `git diff --check`
