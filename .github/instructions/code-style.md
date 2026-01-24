```markdown
# Code Style and Documentation Expectations

## Principles

- Prefer correctness and clarity over cleverness.
- Keep diffs small and localized.
- Code should be self-documenting where possible.

## Comments

- Comments should explain _why_, not restate _what_ the code obviously does.
- Document complex algorithms or non-obvious decisions.
- Keep comments up to date with code changes.

## Documentation Updates

Any behavior change requires updating:
1. Relevant documentation/specs
2. Relevant test coverage
3. `.github/instructions/memory.md` if high-level understanding changed

## Testing Discipline

- Tests are written before implementation (TDD).
- Tests mirror documentation/spec, not current behavior.
- Run the narrowest relevant tests first, then broaden.

## Language-Specific (JavaScript/TypeScript)

- Use TypeScript for new code when possible.
- Prefer `const` over `let`, avoid `var`.
- Use async/await over raw promises.
- Prefer named exports over default exports.
```
