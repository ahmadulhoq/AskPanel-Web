# Module: lib/agents

**Responsibility:** Multi-agent orchestration loop — the core IP of the product. Runs Respondent → Critic → Synthesizer rounds, streams SSE events, persists progress to Firestore.

## Classes / Types

| Name | File | Responsibility |
|---|---|---|
| `Persona` (interface) | personas.ts | Shape of a persona: key, label, description, proOnly flag, respondentSystem/criticSystem prompt strings |
| `AgentPrompt` (interface) | prompts.ts | `{ system, user }` pair returned by prompt builders — system is cached, user is not |
| `ConversationTurn` (interface) | types.ts | One turn in the in-memory history array: `{ role, content, round }` |
| `OrchestratorInput` (interface) | types.ts | `runPanel()` input: panelId, question, config, persona?, context?, customPersona? |
| `SSEGenerator` (type alias) | types.ts | `AsyncGenerator<SSEEvent, void, unknown>` — return type of `runPanel()` |

## Functions

| Name | File | Responsibility |
|---|---|---|
| `getPersona(key)` | personas.ts | Looks up a built-in persona by key, falls back to `'general'` if unknown |
| `buildRespondentPrompt(question, history, personaKey?, context?, custom?)` | prompts.ts | Builds Respondent's system+user prompt. On round 1 without a prior critique, injects context. On later rounds, injects the last critique. `custom` overrides system prompt when `personaKey === 'custom'`. |
| `buildCriticPrompt(question, history, personaKey?, custom?)` | prompts.ts | Builds Critic's system+user prompt from the last Respondent turn. Same custom-override mechanism. |
| `buildSynthesizerPrompt(...)` | prompts.ts | Builds Synthesizer's prompt (not re-read this pass — referenced by orchestrator, signature stable) |
| `SYNTHESIZER_TOOL` (const) | prompts.ts | Anthropic tool schema for the Synthesizer's structured `tool_use` output: `decision`, `confidence`, `reasoning`, `issuesFound`, `finalAnswer` — `issuesFound` is REQUIRED (added when Critic "issues found" badge feature shipped) |
| `streamAgent(role, prompt, model)` | orchestrator.ts | Internal async generator — streams one agent's text response token-by-token via Anthropic `messages.create({ stream: true })` |
| `callSynthesizer(prompt, model)` | orchestrator.ts | Internal — calls Synthesizer via non-streaming `tool_choice: { type: 'any' }`, extracts and returns the tool_use input |
| `leasedUpdate(panelId, leaseId, build)` | orchestrator.ts | Internal — every panel write runs in a transaction that first checks `panel.run.id === leaseId`; throws `LeaseLostError` if another runner took over (2026-10-31) |
| `withRound(data, round, patch)` | orchestrator.ts | Internal — returns `{ rounds }` with one round's fields patched (creates the round if missing) |
| `LeaseLostError` (class) | orchestrator.ts | Thrown when a write is refused because the lease moved; `runPanel` exits silently on it (the new runner owns status) |
| `MAX_ROUNDS` (const) | orchestrator.ts | 3 — backstop clamp; `runPanel` never trusts stored `config.maxRounds`/`config.model` (always uses `DEFAULT_MODEL`, records it in `config.model`) |
| `runPanel(input)` | orchestrator.ts | **Debate engine.** Async generator. Resumes after the last stored step (`input.rounds` via `resumePoint`/`historyBefore`), runs Respondent→Critic→Synthesizer up to the clamped max rounds, yields SSE-shaped events, writes every step through `leasedUpdate`, sets status `running`→`complete`/`error`. Called only by `runPanelJob` — never inside a request's response stream. |
| `resumePoint(rounds, maxRounds)` | runState.ts | Pure — first missing step of the last stored round; next round if it voted `continue`; else re-run the last synthesis (final answer is only stored at completion) |
| `historyBefore(rounds, point)` | runState.ts | Pure — rebuilds the `ConversationTurn[]` the agents had seen before `point` |
| `firstRoundComplete(rounds)` | runState.ts | Pure (tested). Round 1 has a stored verdict — the Stop refund cut-off |
| `runPanelJob(panelId)` | runner.ts | **Run entry point.** Acquires the lease (60s TTL; no-op if a live lease exists or panel is complete/error), heartbeats every 15s, **watches its own doc (onSnapshot) and on lease loss (Stop) aborts the in-flight model call via an AbortSignal passed to `runPanel`** (2026-11-01), consumes `runPanel`, flushes in-progress text to `panel.live` at most 1/s, awaits title generation on completion, refunds the run on error, releases the lease (or clears its own stale `live` if the lease was taken). Never throws. |
| `generatePanelTitle(panelId, question)` | title.ts | Calls Claude (max_tokens:30) for a 5-8 word title and writes it. Catches and logs errors. Awaited by `runPanelJob` after completion (was fire-and-forget after the response, which Cloud Run could throttle). |

## Notes / Findings
- 2026-10-31: debates became background jobs (`runner.ts`). Tests: `lib/agents/runState.test.ts` (`npm test`). Verified end to end against the Firestore emulator + a fake Anthropic API (concurrency, kill-and-resume, lease theft, refunds) — harness was a scratch script, not committed.
- No FIXME/TODO/HACK comments found.
- `runPanel()` has a hard guard: if `isFinalRound && synthesis.decision === 'continue'`, it forces `decision = 'contested'` (and confidence to `'low'` if not already set) — see SACRED S001.
- Synthesizer intentionally uses non-streaming `tool_use` while Respondent/Critic stream — see SACRED S002.
- Every agent's system prompt carries `cache_control: { type: 'ephemeral' }` — see SACRED S003.
- `customPersona` param flows from `OrchestratorInput` through both prompt builders; activated only when `persona === 'custom'` AND a `custom` object is passed — the panel doc is expected to have already resolved and copied the user's saved custom persona onto itself at creation time (see `app/api/panels` module notes), so the orchestrator itself never reads the user doc.
