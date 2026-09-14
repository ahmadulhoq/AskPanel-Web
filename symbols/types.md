# Module: types

**Responsibility:** Single source of truth for every shared domain type — Firestore document shapes, SSE event union, client-side derived state shapes.

## Types

| Name | File | Responsibility |
|---|---|---|
| `SubscriptionTier`, `PanelStatus`, `AgentRole`, `SynthesisDecision`, `ConfidenceLevel` | index.ts | Core string-literal unions used throughout |
| `CustomPersona` | index.ts | `{ label, respondentSystem, criticSystem }` — shape shared between the user doc's saved template and a panel doc's copied-at-creation-time instance |
| `UserSubscription` | index.ts | Stripe-related subscription fields on the user doc |
| `UserDoc` | index.ts | Full user document shape: email, displayName, photoURL, createdAt, freeRunsUsed, freeRunsResetAt, customPersona, subscription |
| `RoundSynthesis` | index.ts | One round's synthesis result as persisted: decision, reasoning, confidence, issuesFound |
| `PanelRound` | index.ts | One round as persisted in `panels/{id}.rounds[]`: roundNumber, respondent, critic, synthesizer (each nullable until that step completes) |
| `PanelConfig` | index.ts | `{ maxRounds, model }` |
| `PanelDoc` | index.ts | Full panel document shape — userId, question, title, persona, customPersona, parentPanelId, context, status, isPublic, createdAt, completedAt, config, rounds, finalAnswer, confidence, errorMessage |
| `SSEEvent` | index.ts | Discriminated union of all 7 SSE event shapes: agent_start, agent_token, agent_complete, synthesis_start, synthesis_result, panel_complete, error. This is the contract between `orchestrator.ts` (producer), `stream/route.ts` (relay + `replayRounds()` synthesizer), and `usePanel.ts` (consumer). |
| `AgentTurnState`, `SynthesisState`, `PanelState` | index.ts | Client-side derived state shapes built by `usePanel`'s reducer from the SSE event stream |

## Notes / Findings
- No FIXME/TODO/HACK comments found.
- This file is intentionally the ONLY place shared domain types live (see CONVENTIONS.md naming patterns) — `lib/agents/types.ts` is a deliberately separate, smaller file for orchestrator-internal-only types (`ConversationTurn`, `OrchestratorInput`, `SSEGenerator`) that aren't part of the app-wide Firestore/SSE contract. Do not merge the two files; the separation reflects a real boundary (agent-internal vs. app-wide).
- Any new field added to `PanelDoc`/`UserDoc` needs a corresponding default in every write path that creates that document (`POST /api/panels`, `POST /api/auth/session`) — there's no schema migration mechanism, so a missing default shows up as `undefined` reads in old documents that predate the field (handled today via `?? null`/`?? 0` fallbacks at every read site, not via a migration).
