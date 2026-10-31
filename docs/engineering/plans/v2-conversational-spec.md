# AskPanel v2 — Conversational Deliberation

> Status: **Draft — approved direction, open decisions in §13**
> Written: 2026-10-30 · Supersedes nothing yet; v1 architecture remains in `mvp-architecture.md`

---

## 1. Summary

AskPanel becomes a conversation. Ordinary messages get a fast, direct reply.
Messages that genuinely need deliberation — decisions, plans, trade-offs, high-stakes
recommendations — are sent to the debate panel, which runs like long "thinking":
the user sees a live "panel deliberating" block, can leave and come back, and the
verdict is posted into the conversation when it's ready. The conversation then
carries on with the verdict as shared context.

The debate engine built for v1 (Respondent → Critic → Synthesizer, personas, rounds,
confidence) is reused unchanged as the deliberation step. What's new is the
conversation around it and the coordinator that decides when to debate.

## 2. Goals and non-goals

**Goals**
- Planning works as a back-and-forth: constraints and follow-ups accumulate in one thread.
- Simple turns answer in seconds; only debatable turns pay the debate's time and cost.
- The user can always override the coordinator in both directions.
- Debates finish even if the user leaves the page.
- The debate stays the visible, differentiating feature — not a hidden backend detail.

**Non-goals (v2)**
- General-purpose assistant features: web browsing, image generation, code execution.
- Long-term memory across separate conversations.
- Team/shared workspaces.

## 3. User experience

### 3.1 Turn types

| Turn | When | What the user sees |
|---|---|---|
| **Quick reply** | Clarifications, rewrites, explanations, small talk, follow-ups that don't need judgment | A normal streamed answer, within seconds |
| **Debate — Critique** (v1 mode) | One recommendation should be stress-tested: "Should I take this job?", "Is this launch plan sound?" | Collapsible "Panel deliberating" block → verdict message with confidence |
| **Debate — Compare options** (new) | The user needs to choose between alternatives: "Plan my Q1 — bootstrap or raise?", "Which of these three architectures?" | Same block, but 2–3 proposals compete and the judge names a winner with reasons |

### 3.2 Who decides

1. **The coordinator decides by default** (see §4) and states its reason in one line:
   *"Convening the panel — this is a trade-off between runway and growth."*
2. **"Debate this"** appears on every quick reply, to escalate it.
3. **"Just answer"** appears while a debate is starting, to downgrade it to a quick reply.
4. **Consent depends on tier** — debates are what's metered:
   - **Free:** the coordinator *proposes* instead of starting: a card reading
     *"This looks worth debating. Run the panel? (uses 1 of 5 this month)"* with Run / Just answer.
   - **Pro:** debates start automatically.
   The rule is enforced on the server, not by the model's judgment.

### 3.3 The long-running debate

- Rendered inline as a collapsed block: *"Panel deliberating · Round 2 · Critic responding…"*.
  Expanding it shows the live debate (today's thread view: agent turns, round dividers,
  synthesis cards).
- When the debate finishes, a **verdict message** is posted: the final answer, the
  confidence badge and a link to the full transcript. For Compare mode, it also says
  which option won and why the others lost.
- The user may leave; the debate keeps running (built in M0, §12). A completed-debate
  indicator shows in the conversation list.
- The user can keep sending quick-reply messages while a debate runs. Those replies
  don't see the unfinished debate, and say so if asked about it.
- **Stop** cancels a running debate. Free users get the run refunded only if it is
  stopped before round 1 completes.

## 4. Coordinator

The coordinator is **not a separate classifier call**. The quick-reply model answers
every message and has one tool, `convene_panel`. If it calls the tool, the server starts
(or proposes) a debate instead of streaming text. Simple messages pay no extra latency.

```ts
convene_panel({
  mode: 'critique' | 'compare',
  question: string,   // self-contained restatement, including constraints from the conversation
  reason: string,     // one line, shown to the user
  options?: string[], // compare mode: the alternatives, if the user named them
})
```

**System-prompt policy** (tuned with real transcripts):
- Call it for: decisions, plans, recommendations with trade-offs, "what should I do",
  evaluating a proposal, choosing between named options, or an explicit request to debate.
- Don't call it for: clarifying questions, rewording, factual lookups, summarizing,
  follow-ups answerable from an existing verdict, small talk.
- Never call it twice in a row without a new user message.

**Instrumentation from day one:** log each decision (debate / no debate, mode) and each
user override ("Debate this" / "Just answer"). The override rate is the routing-quality metric.

## 5. Context management

| Consumer | Receives |
|---|---|
| Quick reply | Rolling conversation summary + last ~10 messages + verdicts of completed debates in this conversation |
| Debate | The coordinator's self-contained `question` + rolling summary + relevant prior verdicts, passed through the existing `context` field (round 1 only, as today) |

The rolling summary is regenerated by a cheap call when the un-summarized tail grows
past a threshold. Verdicts are stored verbatim and never summarized away.

## 6. Data model

All Firestore access stays server-side; client rules deny everything (done in M0).

```
conversations/{cid}
  userId, title, isPublic, createdAt, updatedAt
  summary: string | null          // rolling summary
  summarizedThrough: messageId | null

conversations/{cid}/messages/{mid}
  role: 'user' | 'assistant'
  kind: 'text' | 'debate' | 'debate_proposal'
  content: string                 // text, or the verdict once a debate completes
  panelId?: string                // kind = debate | debate_proposal
  status: 'streaming' | 'complete' | 'error'
  createdAt

panels/{pid}                      // unchanged v1 shape, plus:
  conversationId?: string
  messageId?: string
  mode: 'critique' | 'compare'    // absent = 'critique'
```

Reusing `panels` means the runner, export, share page, retry and replay all work for
debates inside conversations without changes.

## 7. Server architecture

### 7.1 Routes

| Route | Purpose |
|---|---|
| `POST /api/conversations` | Create a conversation |
| `POST /api/conversations/[cid]/messages` | Send a message. Streams the quick reply over SSE, or emits `debate_started` / `debate_proposed` with a `panelId` |
| `POST /api/conversations/[cid]/debates` | Start a debate explicitly ("Debate this", or "Run" on a proposal) |
| `POST /api/panels/[pid]/cancel` | Stop a running debate |
| `GET /api/panels/[pid]/stream` | Existing debate stream (tails Firestore since M0) |

### 7.2 Debate execution — built in M0

- Debates run in a server-side runner that is **not tied to any browser connection**.
- A lease on the panel doc guarantees one runner at a time. Heartbeats renew it; if the
  instance dies, the lease expires and the next viewer's connection restarts the runner.
- The runner **resumes from the last completed step** (respondent → critic → synthesis),
  so an interruption never re-runs or re-bills completed work.
- In-progress agent text is flushed to the panel doc about once a second; the stream route
  tails the doc and converts changes into the existing SSE events. The client protocol is
  unchanged.
- `apphosting.yaml` sets `cpuAlwaysAllocated: true`, so a debate keeps full CPU after the
  user leaves. Without it, debates still resume correctly when the user returns, but stall
  while nobody is watching.
- **Scale-up path:** if traffic grows or plugin clients (§11) start debates with no viewer,
  move dispatch to Cloud Tasks targeting an internal run route, which gives managed retries.
  Nothing else in the design changes.

### 7.3 Compare-options mode

New orchestrator mode beside the existing one; the critique loop and its SACRED
behaviours (S001–S003) are not modified.

1. **Proposers** (2–3 calls, streamed): each produces one distinct option. Each is told
   the options already proposed and must differ. If the user named options, each
   proposer argues for one of them.
2. **Critic** (1 call, streamed): attacks every option against the user's constraints.
3. **Judge** (1 call, `tool_use`): returns `{ winner, scores[], reasoning, finalAnswer, confidence }`.
   `finalAnswer` must say why the losing options lost.
4. One round by default. Pro can run a second round where proposers revise.

About 5 model calls, versus up to 9 for a 3-round critique.

## 8. Metering and pricing

- **Debates** are the metered unit (today's `freeRunsUsed`, renamed in UI to "debates").
  Counted when a debate is reserved at creation inside the limit transaction, refunded
  on failure.
- **Quick replies** are cheap but not free: free tier gets a daily fair-use cap (see §13).
- **Pro** needs a real ceiling. The v1 upgrade dialog promises 100/month while the code
  is unlimited — resolve this before v2 pricing ships.

## 9. UI

- Conversation layout from **AI Elements** (copied into the repo, adapted): `Conversation`
  (built on `use-stick-to-bottom`), `Message`, `PromptInput` (trimmed — no attachments menu
  in M1), `Reasoning`-style collapsible for the debate block.
- **Streamdown** replaces `react-markdown` everywhere streamed text renders.
- The existing debate thread components (`AgentTurn`, `SynthesisCard`, `FinalAnswer`)
  render inside the expanded debate block — no rewrite.
- Dashboard becomes a conversation list (title, last activity, debate count).

## 10. Migration from v1

- Each existing panel becomes a one-message conversation whose single assistant message
  is a `debate` pointing at the panel. A `parentPanelId` chain becomes one conversation,
  in order.
- `/panel/[id]` stays a valid transcript URL. Public share links (`/p/[id]`) are unchanged.
- One-off migration script run server-side; idempotent (keyed on panel id).

## 11. Distribution: plugin / MCP server

The debate engine is exposed as an **MCP server** so people can call it from the AI tools
they already use (Claude, ChatGPT, Cursor and other MCP clients). The host assistant
plays the coordinator's role and calls the tool when a question is debatable.

- Hosts commonly time out tool calls at about 60 seconds, and a debate takes minutes.
  So the tools are asynchronous: `start_debate` returns immediately with a debate id
  and a transcript link, and `get_debate_result` returns the verdict once it's ready.
  Adopt MCP Tasks once host support is broad.
- Each result links back to the full transcript on askpanel.app — the plugin is a
  distribution channel that feeds the web product, not a replacement for it.
- Auth via OAuth to the user's AskPanel account; debates count against the same quota.

## 12. Phasing

| Milestone | Scope |
|---|---|
| **M0** (done 2026-10-31) | Security lockdown (Firestore rules, Next.js upgrade); background debate runner with lease, resume and Firestore-tailed streaming |
| **M1** | Conversation data model, quick replies, chat UI, explicit "Debate this" (no auto-routing yet) |
| **M2** | Coordinator tool, auto-routing, free-tier consent card, override logging, metering changes |
| **M3** | Compare-options mode |
| **M4** | v1 migration, dashboard → conversation list, launch |
| **M5** | MCP server with async `start_debate` / `get_debate_result` |

M1 alone is shippable: a chat with a manual debate button is already better than v1's
page-per-follow-up.

## 13. Open decisions

1. **Quick-reply model:** Sonnet 5.5 for quality, or a cheaper model (e.g. Haiku 4.5) for
   speed and cost — the coordinator quality depends on this choice.
2. **Free tier:** how many debates a month, and the daily quick-reply cap.
3. **Pro ceiling:** a monthly debate cap, or unlimited with fair-use throttling.
4. **Sharing:** share whole conversations, individual debates only (today), or both.
5. **`cpuAlwaysAllocated`:** keep it on (debates finish while users are away; higher
   hosting cost), or turn it off (cheaper; debates resume when the user returns).

## 14. Risks

| Risk | Mitigation |
|---|---|
| Coordinator debates too often (slow, costly) or too rarely (loses the differentiator) | Override buttons; override-rate metric; tune the prompt on logged transcripts |
| Long conversations blow up context and cost | Rolling summary; verdicts kept verbatim; cap last-N messages |
| Becomes "a slower ChatGPT" | Debate stays visually central; Compare mode has no equivalent in general assistants |
| Debate exceeds the request timeout | Runs are decoupled from requests (M0); clients reconnect and replay |
| Host plugins time out on long debates | Async start/poll tools (§11) |
