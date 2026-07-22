# Skill Bindings

Status: DRAFT

## Project Skills

- `project-maestro`: use for controlled project cycles, memory, owner gates, validation, and task queue hygiene.
- `server-ops`: use before SSH/SCP/server deployment or service management for `focus-v2`.
- `playwright`: use for browser/UI verification when layout or PWA behavior changes.

## Project-Specific Constraints

- Deployment to `https://focus-v2.dmnao83.ru` is owner-gated.
- Backend restart is owner-gated and should follow `server-ops`.
- Product/runtime tasks require Git baseline and a clear spec reference or owner-approved exception.

