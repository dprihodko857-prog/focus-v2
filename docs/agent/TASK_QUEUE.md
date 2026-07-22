# Task Queue

Status values: DRAFT, READY, IN_PROGRESS, BLOCKED, BLOCKED_OWNER, PARTIALLY_VERIFIED, DONE, CANCELLED

## TASK-001

- title: Initialize Project Maestro memory and local Git baseline
- status: DONE
- owner_gate: approved
- task_type: onboarding
- priority: high
- source: owner approved option A on 2026-07-22
- spec_reference: not required for onboarding
- spec_status: not_required
- goal: create a recoverable project baseline with `.gitignore`, `docs/agent` memory, Git initialization, and test evidence.
- out_of_scope:
  - product/runtime behavior changes
  - production deployment
  - remote Git configuration
  - push, tag, release, or domain changes
- acceptance_criteria:
  - project backup exists before Git baseline work
  - `.gitignore` excludes generated, local, secret, and temporary artifacts
  - required `docs/agent` memory files exist with factual draft content
  - Git repository is initialized locally
  - `npm.cmd test` passes or the blocker is recorded
- required_checks:
  - `npm.cmd test`
  - `git status --short`
  - `git diff --stat`
- sandbox_level: current_workspace
- cycle_budget: one onboarding/baseline task
- file_limit: expected up to 14 docs/config files
- command_limit: expected up to 12 meaningful commands
- chain_position: 1
- stop_conditions:
  - tests fail in a way unrelated to onboarding
  - generated, binary, temp, secret, or unrelated files would be staged
  - commit requires a separate owner confirmation after status and diff stat
- areas:
  - `.gitignore`
  - `docs/agent`
  - Git baseline
- dependencies:
  - owner approval for option A
- design_review_required: false
- security_review_required: false
- outcome: local_git_baseline_created
- commit_status: committed
- notes: Backup created, memory files added, Git initialized, ignore rules checked, `npm.cmd test` passed 83/83, and the first local baseline commit was owner-approved. No push or deployment.

## TASK-002

- title: Prepare next approved notification hardening slice
- status: DRAFT
- owner_gate: pending
- task_type: spec_planning
- priority: medium
- source: prior owner discussion about notification hardening
- spec_reference: missing
- spec_status: missing
- goal: define one bounded next notification reliability task with acceptance criteria and required checks.
- out_of_scope:
  - runtime implementation
  - production deployment
  - new external notification provider
- acceptance_criteria:
  - owner-approved scope exists
  - acceptance criteria and required checks are clear
  - product/runtime work remains blocked until approved
- required_checks:
  - docs inspection only
- sandbox_level: current_workspace
- cycle_budget: one planning task
- file_limit: docs/spec files only
- command_limit: up to 6 read-only commands
- chain_position: 1
- stop_conditions:
  - owner chooses a different roadmap priority
- areas:
  - `docs/agent/TASK_QUEUE.md`
  - `docs/specs/`
- dependencies:
  - TASK-001 baseline completion
- design_review_required: false
- security_review_required: true
- outcome:
- commit_status: not_required
- notes:

Only implement tasks with `status: READY` and `owner_gate: not_required` or `owner_gate: approved`.
