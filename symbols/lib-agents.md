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
| `updateRoundField(panelId, round, role, content)` | orchestrator.ts | Internal — patches `rounds[]` array in Firestore with a Respondent/Critic turn's content |
| `updateSynthesisField(panelId, round, synthesis)` | orchestrator.ts | Internal — patches `rounds[]` array with a round's synthesis result |
| `runPanel(input)` | orchestrator.ts | **Main entry point.** Async generator — runs the full Respondent→Critic→Synthesizer loop up to `config.maxRounds`, yields SSE events at each step, persists every step to Firestore, sets panel status to `running`→`complete`/`error` |
| `generatePanelTitle(panelId, question)` | title.ts | Fire-and-forget — calls Claude (max_tokens:30) to generate a 5-8 word title, writes it to the panel doc. Catches and logs all errors silently (panel is already complete, no user-facing error needed). |

## Notes / Findings
- No FIXME/TODO/HACK comments found.
- `runPanel()` has a hard guard: if `isFinalRound && synthesis.decision === 'continue'`, it forces `decision = 'contested'` (and confidence to `'low'` if not already set) — see SACRED S001.
- Synthesizer intentionally uses non-streaming `tool_use` while Respondent/Critic stream — see SACRED S002.
- Every agent's system prompt carries `cache_control: { type: 'ephemeral' }` — see SACRED S003.
- `customPersona` param flows from `OrchestratorInput` through both prompt builders; activated only when `persona === 'custom'` AND a `custom` object is passed — the panel doc is expected to have already resolved and copied the user's saved custom persona onto itself at creation time (see `app/api/panels` module notes), so the orchestrator itself never reads the user doc.
