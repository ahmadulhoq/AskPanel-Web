# Coding Style Guide — AskPanel Web

---

## 1. General Principles

- **Readability over cleverness.** Code is read 10x more than written.
- **Consistency over personal preference.** Follow existing patterns in a file.
- **Self-documenting code.** Names should explain intent. Comments explain *why*, not *what*.
- **Small, focused units.** Functions do one thing. Classes have one responsibility.
- **Fail fast and loud.** Surface errors early; never swallow exceptions silently.

---

## 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Classes / Types | PascalCase | `UserRepository` |
| Constants | SCREAMING_SNAKE | `MAX_RETRY_COUNT` |
| Boolean vars | is/has/should prefix | `isAuthenticated`, `hasExpired` |
| Functions / Methods | camelCase | `getSessionUser` |
| Variables | camelCase | `panelId` |
| File names | kebab-case | `panel-thread.tsx` |
| React components | PascalCase | `PanelThread` |

---

## 3. TypeScript

- Prefer `interface` over `type` for object shapes. Use `type` for unions and utility types.
- Avoid `any`. Use `unknown` when the type is genuinely unknown, then narrow.
- Use strict mode (`"strict": true` in tsconfig).
- Prefer `const` over `let`. Never use `var`.
- Use `readonly` for object properties that should not be mutated.

---

## 4. Async

- Use `async/await` over raw Promises. Never mix callbacks and promises.
- Always handle promise rejections — no unhandled promise warnings.

---

## 5. Import Ordering

Group imports in this order, separated by blank lines:
1. Node / framework imports (`react`, `next/*`)
2. Third-party library imports (`firebase/*`, `@anthropic-ai/sdk`, `stripe`)
3. Project / internal imports (`@/lib/*`, `@/components/*`, `@/types`)

---

## 6. Error Handling

- Define domain-specific error types (not generic `Error`).
- Include actionable information in error messages.
- Log errors with context (what operation, what input, what went wrong).
- Never catch-all silently. At minimum, log the error.

---

## 7. Documentation

- **Public API:** Every public function should have a concise comment explaining purpose and non-obvious behavior.
- **Why, not what:** Comments explain reasoning and intent, not obvious mechanics.

---

## 8. Testing

- **Test naming:** `it('should [expected behavior] when [condition]')`.
- **Arrange-Act-Assert** pattern for all unit tests.
- **No logic in tests.** Tests should be straightforward assertions.
- **Coverage:** Aim for 85%+ on business logic (orchestrator, prompts, auth utils).

---

## 9. Git Conventions

- **Branch naming:** `[ticket-id]-short-description` or `debt-id-description`
- **Commit messages:** `[type]: short description` where type is `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
- **PR size:** Keep under 400 lines of code changes when possible.
