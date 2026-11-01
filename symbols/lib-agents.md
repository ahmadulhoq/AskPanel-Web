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
| `streamAgent(role, prompt, model, signal)` | orchestrator.ts | Async generator (shared with compare.ts) — streams one agent's text via `messages.create({ stream: true })`, 16k cap, `output_config.effort: DEBATE_EFFORT`. Throws on a refusal or a turn with no text (never stores an empty turn) (2026-11-01, PR #10) |
| `requestToolCall(prompt, model, tools, signal)` | orchestrator.ts | Shared by the Synthesizer and the compare Judge (SACRED S002). Non-streaming, `tool_choice: auto` + strict tool (Sonnet 5.5 400s on forced choice), 16k cap, effort pinned. A text answer is kept and followed by "Call the <tool> tool…" once; `max_tokens`/`refusal` stop without retry. Returns `{ input, stopReason }` (input null if no complete tool call) (2026-11-01, PR #10) |
| `callSynthesizer(prompt, model, signal)` | orchestrator.ts | Internal — `requestToolCall(SYNTHESIZER_TOOL)` + `parseSynthesis`; throws "verdict was cut off" / "did not return a usable verdict" |
| `leasedUpdate(panelId, leaseId, build)` | orchestrator.ts | Internal — every panel write runs in a transaction that first checks `panel.run.id === leaseId`; throws `LeaseLostError` if another runner took over (2026-10-31) |
| `withRound(data, round, patch)` | orchestrator.ts | Internal — returns `{ rounds }` with one round's fields patched (creates the round if missing) |
| `LeaseLostError` (class) | orchestrator.ts | Thrown when a write is refused because the lease moved; `runPanel` exits silently on it (the new runner owns status) |
| `MAX_ROUNDS` (const) | orchestrator.ts | 3 — backstop clamp; `runPanel` never trusts stored `config.maxRounds`/`config.model` (always uses `DEFAULT_MODEL`, records it in `config.model`) |
| `runPanel(input)` | orchestrator.ts | **Debate engine.** Async generator. Resumes after the last stored step (`input.rounds` via `resumePoint`/`historyBefore`), runs Respondent→Critic→Synthesizer up to the clamped max rounds, yields SSE-shaped events, writes every step through `leasedUpdate`, sets status `running`→`complete`/`error`. Called only by `runPanelJob` — never inside a request's response stream. |
| `resumePoint(rounds, maxRounds)` | runState.ts | Pure — first missing step of the last stored round; next round if it voted `continue`; else re-run the last synthesis (final answer is only stored at completion) |
| `historyBefore(rounds, point)` | runState.ts | Pure — rebuilds the `ConversationTurn[]` the agents had seen before `point` |
| `firstRoundComplete(rounds)` | runState.ts | Pure (tested). Round 1 has a stored verdict — the Stop refund cut-off |
| `parseSynthesis(input)` / `Synthesis` (type) | runState.ts | Pure (tested). Validates the Synthesizer's tool input: known decision + non-empty answer required; confidence → medium, issuesFound → 0 by default; null if unusable (e.g. cut off) (2026-11-01, PR #10) |
| `runPanelJob(panelId)` | runner.ts | **Run entry point.** Acquires the lease (60s TTL; no-op if a live lease exists or panel is complete/error), heartbeats every 15s, **watches its own doc (onSnapshot) and on lease loss (Stop) aborts the in-flight model call via an AbortSignal passed to `runPanel`** (2026-11-01), consumes `runPanel`, flushes in-progress text to `panel.live` at most 1/s, awaits title generation on completion, refunds the run on error, releases the lease (or clears its own stale `live` if the lease was taken). Never throws. |
| `generatePanelTitle(panelId, question)` | title.ts | Calls Claude (max_tokens:30) for a 5-8 word title and writes it. Catches and logs errors. Awaited by `runPanelJob` after completion (was fire-and-forget after the response, which Cloud Run could throttle). |

## Notes / Findings
- 2026-10-31: debates became background jobs (`runner.ts`). Tests: `lib/agents/runState.test.ts` (`npm test`). Verified end to end against the Firestore emulator + a fake Anthropic API (concurrency, kill-and-resume, lease theft, refunds) — harness was a scratch script, not committed.
- No FIXME/TODO/HACK comments found.
- `runPanel()` has a hard guard: if `isFinalRound && synthesis.decision === 'continue'`, it forces `decision = 'contested'` (and confidence to `'low'` if not already set) — see SACRED S001.
- Synthesizer intentionally uses non-streaming `tool_use` while Respondent/Critic stream — see SACRED S002.
- Every agent's system prompt carries `cache_control: { type: 'ephemeral' }` — see SACRED S003.
- `customPersona` param flows from `OrchestratorInput` through both prompt builders; activated only when `persona === 'custom'` AND a `custom` object is passed — the panel doc is expected to have already resolved and copied the user's saved custom persona onto itself at creation time (see `app/api/panels` module notes), so the orchestrator itself never reads the user doc.

## Compare mode (2026-11-01, BL-043 — spec §7.3)
| Name | File | Responsibility |
|---|---|---|
| `runCompare(input)` | compare.ts | Proposers ×3 (streamed, `agent: 'proposer'`, `index` 0..2) → Critic (streamed) → Judge (`tool_use` `judge_options`, 3000 max tokens) → one write of `compare.judgement` + `status: 'complete'`, `finalAnswer`, `confidence`. Resumes via `compareResumePoint`; lease-checked writes; exits quietly on `LeaseLostError` or abort. `runPanelJob` picks it when `panel.mode === 'compare'`. |
| `streamTurn(agent, index, prompt, model, signal)` | compare.ts | Yields agent_start/agent_token for one turn, returns the text |
| `PROPOSER_COUNT` (3), `emptyCompare()`, `compareResumePoint(compare)`, `optionName(content, fallback)`, `parseJudgement(input, options)`, `compareRunCounts(compare)` | compareState.ts | Pure (tested). Judge input validated: winner 1..n, scores clamped 1–10 and deduplicated, confidence fallback 'medium'. A compare run counts for Stop once all options are in. |
| `buildProposerPrompt`, `buildCompareCriticPrompt`, `buildJudgePrompt`, `JUDGE_TOOL` | comparePrompts.ts | Static cached system prompts; a persona contributes only a "lens" line (its prompts are written for Respondent/Critic). Proposer k argues for the k-th option named in the question, else the best uncovered alternative. |
- `orchestrator.ts` now exports `streamAgent` (role widened to `AgentRole`) and `leasedUpdate` (+ `PanelData`) for compare.ts. `runPanel` itself is unchanged (S001–S003).
