# Copilot Instruction Set

This folder contains the _canonical_ instructions for working in this repository.

## Files

- `memory.md` — Living, curated "memory" of the codebase: architecture, file map, invariants.
- `tdd.md` — Documentation-first TDD workflow.
- `workspace-hygiene.md` — What counts as "artifact" and when to delete it.
- `code-style.md` — Naming, structure, and style conventions.
- `seating-ai.md` — Canonical reference for the venue seating layout editor and Ollama `analyze-image` AI feature.

## Agents (in `.github/agents/`)

- **Orchestrator** — Central coordinator; manages Plan → Implement → Style → Audit workflow.
- **Plan** — Research and outline multi-step plans before implementation.
- **Implement** — Execute planned changes with TDD discipline.
- **Style** — Kevin Powell-style modern CSS; enforces design tokens and primitives.
- **Audit** — OWASP-focused security review for auth, payment, and data-handling code.

## How to Use

1. Before any non-trivial change: read `memory.md` and relevant docs.
2. For complex work: use the **Plan** agent first to outline the approach.
3. Update docs/spec first, then add/update tests.
4. Use the **Implement** agent (or work manually) to make the smallest correct change.
5. Run the narrowest test set first, then expand.
6. After the user confirms the issue is solved: run cleanup per `workspace-hygiene.md`.
