```markdown
# Copilot Instruction Set

This folder contains the _canonical_ instructions for working in this repository.

## Files

- `memory.md` — Living, curated "memory" of the codebase: architecture, file map, invariants.
- `tdd.md` — Documentation-first TDD workflow.
- `workspace-hygiene.md` — What counts as "artifact" and when to delete it.
- `code-style.md` — Naming, structure, and style conventions.

## Agents (in `.github/agents/`)

- **Plan** — Research and outline multi-step plans before implementation.
- **Implement** — Execute planned changes with TDD discipline.

## How to Use

1. Before any non-trivial change: read `memory.md` and relevant docs.
2. For complex work: use the **Plan** agent first to outline the approach.
3. Update docs/spec first, then add/update tests.
4. Use the **Implement** agent (or work manually) to make the smallest correct change.
5. Run the narrowest test set first, then expand.
6. After the user confirms the issue is solved: run cleanup per `workspace-hygiene.md`.

```
