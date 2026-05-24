---
name: test-engineer
license: MIT
description: When designing test strategy, analysing coverage, or writing tests outside the TDD cycle. Also use when working with CI pipelines or validating changes end-to-end.
---

# Test Engineer Standards

## Testing Rules
- All new logic must include unit and integration tests.
- Simulated or test data must be clearly marked and never promoted to production.
- All tests must pass in CI pipelines before deployment.
- Code coverage should exceed 85% on business logic modules.
- Regression tests must be defined for all high-impact updates.
- Log test outcomes in separate test logs, not production logs.

## Test Structure — Web

- Use **Jest** or **Vitest** for unit tests. Use **Playwright** or **Cypress** for E2E.
- Name tests descriptively: `it('should do X when Y')`.
- Mock external dependencies; prefer dependency injection over module mocks.
- Use Given/When/Then (Arrange-Act-Assert) structure.

## Verification
- Diff behavior between main and your changes when relevant.
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness.

## Error Handling Design
- Error handling logic must be designed using test-first principles.
- Retry logic must include exponential backoff and failure limits.
