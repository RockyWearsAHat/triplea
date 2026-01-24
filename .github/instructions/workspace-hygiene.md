```markdown
# Workspace Hygiene (Artifacts, Cleanup, and When)

This repo may generate build/test/debug output. Keeping the workspace clean improves signal-to-noise and reduces accidental commits.

## What is an artifact?

Artifacts are files and folders that are not source-of-truth and can be regenerated.

Common examples:
- Build outputs: `build/`, `dist/`, `target/`, `node_modules/`
- Logs: `*.log`, `debug.log`
- Editor backups: `*.bak`, `*.swp`, `*.tmp`
- Test outputs: `coverage/`, `.pytest_cache/`

## What is NOT automatically deleted?

These may be needed for reproduction or comparison:
- Configuration files
- Environment-specific settings
- Test fixtures and data

## Cleanup Policy

### Routine cleanup (safe-by-default)

Remove build outputs and temporary files that can be regenerated.

### Aggressive cleanup (only after verification)

Only after the user confirms that the issue is solved:
- Remove logs and debug output
- Clean caches and intermediate files

## Required Rule: User Verification Gate

If a task is "fix bug X", the cleanup step is **blocked** until the user confirms the behavior is solved.

Reason: artifacts are often required to reproduce and verify the fix.
```
