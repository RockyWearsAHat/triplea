```markdown
# Documentation-First TDD (Spec → Tests → Implementation)

This project's correctness and maintainability depend on treating **documentation as the primary spec**.

## The Rule

1. **Write/Update documentation first** (what the system must do).
2. **Write tests that mirror the documentation** (not current behavior).
3. **Implement** until tests pass.
4. **Refactor** while keeping tests green.

If documentation is incomplete, write the missing spec _before_ writing tests.

## Workflow Checklist

### 1) Spec (docs)

- Identify the rule you're implementing.
- Cite source material if applicable.
- Define: inputs, outputs, edge cases.

### 2) Tests (mirror docs)

- Add tests that encode the spec.
- Prefer small, deterministic tests.
- Make tests independent.

**Important:** do not "lock in" current bugs. If current behavior contradicts the spec, the test should assert the spec.

### 3) Implementation

- Implement the smallest change to satisfy the test.
- Keep changes local and avoid refactoring unrelated code.

### 4) Verification and cleanup

- Run targeted tests first, then expand.
- Only after user confirms the problem is solved: run cleanup.

## Test Naming

Use descriptive test names like:
- `Feature_Scenario_ExpectedBehavior`
- `ClassName_MethodName_ConditionAndResult`

```
