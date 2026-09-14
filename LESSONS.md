# Agent Lessons Learned

<!-- The agent writes entries here after being corrected.
     It reads this file at session start to avoid repeating mistakes.
     Format: ## Lesson NNN — YYYY-MM-DD
     Include: Mistake, Pattern, Rule -->

## Lesson 001 — 2026-09-14

**Mistake (pre-dates this memory system, found during cartography):** The shared shadcn `Textarea` primitive (`components/ui/textarea.tsx`) uses the experimental `field-sizing-content` CSS property for auto-grow behavior. Early in this project's development, this exact property caused a "jumping textarea" bug on the question-input page (unbounded, jittery growth as the user typed) — the very first bug fixed in this project's history. The fix that shipped was to bypass `Textarea` entirely: `PanelInput.tsx` and `FollowUpComposer.tsx` each hand-roll a plain `<textarea>` with a JS-controlled resize function (reset height to `'auto'`, measure `scrollHeight`, clamp to a max, toggle `overflowY`). `components/ui/textarea.tsx` itself was never fixed — it still has the same `field-sizing-content` property and is simply unused by any current call site (verified via grep — zero imports of `@/components/ui/textarea` anywhere in the app).

**Pattern:** A bug was fixed by routing around the buggy shared component rather than fixing the shared component itself. The buggy code still exists in the codebase, just currently dead.

**Rule:** Before importing/using `components/ui/textarea.tsx` (`<Textarea>`) anywhere in this codebase, either (a) fix `field-sizing-content` there first using the same JS-controlled resize pattern already proven in `PanelInput.tsx`, or (b) keep hand-rolling a plain `<textarea>` with that pattern instead of reaching for the shared primitive. Do not assume `<Textarea>` auto-grows correctly just because it looks like the "proper" shadcn component to use — it has the exact bug this project already paid to fix once. Logged as TD-004 in TECH_DEBT.md for a proper fix.
