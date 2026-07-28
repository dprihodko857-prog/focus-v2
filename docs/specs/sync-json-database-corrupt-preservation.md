# Sync JSON Database Corrupt Preservation

Status: IMPLEMENTED_LOCAL_COMMITTED

Implementation note: TASK-032 implemented and committed locally on 2026-07-28; deployment remains postponed by owner.

## Context

The sync backend stores account, device, collection, and push state in a local JSON file. Writes already use a temporary file followed by rename, but startup currently returns an empty state if the existing database file cannot be parsed.

## Goal

Prevent a corrupted JSON database file from being silently overwritten by a new empty state.

## Requirements

- Keep normal database loading behavior unchanged for valid JSON.
- Keep memory-only database behavior unchanged for tests and ephemeral runs.
- If the database file exists but cannot be parsed, preserve the unreadable file by renaming it to a sibling backup path before returning an empty state.
- Use a unique backup filename so repeated failures do not overwrite previous preserved files.
- If the corrupted file cannot be preserved, fail startup instead of silently replacing it.
- Add focused server tests for corrupted database preservation.

## Out Of Scope

- Migrating from JSON to SQLite or another database.
- Automatic data repair or partial JSON recovery.
- UI changes.
- Production deploy, git push, tags, or release work.

## Acceptance

- A valid database still loads existing account/snapshot state.
- An invalid existing database is moved to a `.corrupt-*` sibling file.
- After preserving the invalid file, the backend can create a fresh database file.
- Existing tests pass locally.
