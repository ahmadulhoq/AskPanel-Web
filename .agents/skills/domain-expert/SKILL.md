---
name: domain-expert
license: MIT
description: When working on features that require AskPanel domain knowledge — agent orchestration, deliberation logic, confidence scoring, or usage/billing rules.
---

# AskPanel Domain Expert

## Domain Overview
AskPanel is a multi-agent AI deliberation platform. A user asks a question; the system runs a structured debate between three AI roles and produces a stress-tested answer with a confidence level. The core value is epistemic rigour — the answer has been challenged and defended before being presented.

## Key Concepts

| Term | Definition |
|------|-----------|
| **Panel** | A single run of the deliberation system for one question. Stored as a Firestore doc. |
| **Round** | One Respondent + Critic + Synthesizer cycle. Max 2 rounds (MVP). |
| **Respondent** | Agent that answers the question (or defends/refines its answer in subsequent rounds). |
| **Critic** | Quality auditor — raises genuine gaps, not manufactured objections. Agreement is valid. |
| **Synthesizer** | Judge — decides consensus/continue/contested and produces the final answer. |
| **Confidence Level** | `high` / `medium` / `low` / `contested` — output of the Synthesizer. |
| **SSE** | Server-Sent Events — how agent tokens stream to the client in real time. |
| **isFinalRound** | Boolean passed to Synthesizer; triggers hard-guard forcing non-'continue' decision. |

## Business Rules
- **Free tier:** 5 lifetime runs. Enforced via Firestore transaction in `POST /api/panels`.
- **Pro tier:** $15/mo via Stripe. Unlimited runs. Downgrade handled via `customer.subscription.deleted` webhook.
- **Public panels:** `isPublic: true` by default. Readable at `/p/[panelId]` without auth.
- **Run limit check:** must be atomic (Firestore transaction) — two parallel requests must not both pass a near-limit check.
- **Usage increment:** only on `panel_complete` event (stream route), not on panel creation.

## Common Pitfalls
- **Synthesizer 'continue' loop:** If the Synthesizer keeps returning 'continue', the panel never ends. The `isFinalRound` hard-guard in `orchestrator.ts` prevents this — never remove it.
- **Over-adversarial Critic:** The Critic reframed as "quality auditor, not adversary" — it should agree when the answer is solid. Reverting to adversarial framing causes unnecessary round 2 runs and higher cost.
- **Cost awareness:** Each round costs ~$0.04 (uncached) or ~$0.022 (cached). Prompt caching on system prompts (`cache_control: ephemeral`) is intentional — do not remove.
- **SSE client disconnect:** Server continues the run and writes to Firestore. Client reconnects and reads final state from Firestore. No SSE replay needed.

## Reference
- Architecture plan: `docs/engineering/plans/mvp-architecture.md`
- Orchestrator: `lib/agents/orchestrator.ts`
- Prompts: `lib/agents/prompts.ts`
- Types: `types/index.ts`
