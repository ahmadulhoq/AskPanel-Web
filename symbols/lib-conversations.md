# Module: lib/conversations (v2 M1, 2026-10-31)

**Responsibility:** Conversation storage, model context, quick-reply generation, titles.

| Name | File | Responsibility |
|---|---|---|
| `conversationRef(cid)` / `messagesRef(cid)` | store.ts | `conversations/{cid}` and its `messages` subcollection |
| `getOwnedConversation(cid, uid)` | store.ts | Ownership check; null if missing or not the user's |
| `NewMessage` / `toMessageView(id, m, debate)` | store.ts | Message without `createdAt` (added at write as serverTimestamp) / plain view for the client. A reply still `streaming` after 5 min reads as `error`. |
| `loadMessages(cid, limit)` | store.ts | Latest messages by `seq`, oldest first, each debate joined with its panel's status/finalAnswer/confidence (`getAll`) |
| `nextSeq(history)` | store.ts | Ordering key: wall-clock ms, strictly after the last message |
| `toModelMessages(history, maxChars, summary?)` | context.ts | Pure (tested). Alternating Anthropic messages starting with user; debate verdicts as `[Panel verdict — confidence: …]` assistant turns; running/failed/stopped debates described, never invented; failed empty replies dropped; trimmed oldest-first keeping the newest turn. A rolling summary opens the first user turn as `[Summary of the earlier conversation]` and is NOT counted against `maxChars` (so the window doesn't move when the summary grows). |
| `debateContext(history, maxChars, summary?)` | context.ts | Pure (tested). "Earlier in this conversation:" brief — `Summary: …` (≤ half the budget) then User/Assistant/Panel verdict lines, newest kept, ~3.5k chars — passed to `createPanel` as `userContext` |
| `REPLY_BUDGET_CHARS` (24k) / `REPLY_WINDOW_MESSAGES` (60) / `REPLY_SLACK_*` (3k chars, 8 msgs) / `REPLY_LOAD_MESSAGES` (80) | context.ts | The reply window, the not-yet-summarized slack replies still see, and how many messages the reply route loads |
| `summaryBacklog(history, throughSeq, maxChars)` | context.ts | Pure (tested). Messages left of the reply window (last 60 within 24k) with `seq > throughSeq`; empty until ≥3k chars or ≥8 messages built up |
| `replyHistory(history, throughSeq)` | context.ts | Pure (tested). Unsummarized messages, last 60+8 — what a reply sees besides the summary |
| `transcriptLine(m)` | context.ts | `User: …` / `Assistant: …` / `Panel verdict (confidence: x): …` line, or null |
| `updateSummary(cid, { history, summary, summarizedThroughSeq })` | summary.ts | After each reply, from the route's in-memory messages (no extra reads in the usual no-op case): folds `summaryBacklog` into `conversation.summary` (≤300 words, keeps every verdict + confidence; DEFAULT_MODEL, cached system prompt) and advances `summarizedThroughSeq`, in a transaction that skips if another update landed first. Never throws. |
| `DEFAULT_DEBATE_SETTINGS` / `sanitizeDebateSettings(input)` | settings.ts | `{ persona: 'general', maxRounds: 2 }` / untrusted → known persona key (or 'custom') + rounds 1..3 (tier limits applied by createPanel) |
| `streamReply(messages)` | reply.ts | Streams a quick reply (DEFAULT_MODEL, cached system prompt: answer directly, suggest Debate for trade-offs, never claim a debate happened) |
| `titleConversation(cid, firstMessage)` | title.ts | Names a conversation via `generateTitle()`; best effort |

Conversation doc fields added 2026-11-01 (BL-048): `summary`, `summarizedThroughSeq`, `debateSettings` (stored only when the client sends settings).

- `deleteConversation(cid, uid)` (delete.ts, BL-040): stops its running debates in parallel, recursive-deletes the conversation (doc first, so in-flight message writes — which also update the conversation doc — fail), deletes its panels, then sweeps panels created meanwhile.

## Coordinator (2026-11-01, BL-042 — spec §4)
| Name | File | Responsibility |
|---|---|---|
| `streamReply(messages, { allowPanel })` | reply.ts | Two cached system prompts: COORDINATOR (with `convene_panel` tool, routing policy) and ANSWER ("Just answer", no tool). Yields `{type:'text'}` chunks, or one `{type:'panel', routing}` when the tool is called (input built from `input_json_delta`); an unusable tool call falls back to a direct answer |
| `CONVENE_PANEL_TOOL` | reply.ts | `{ mode: critique|compare, question, reason, options? }` |
| `parseRouting(input)` | routing.ts | Pure (tested): question ≥10 chars (≤2000), reason default, mode default critique, named options appended to a compare question if missing |
| `respond(opts)` | respond.ts | SSE responder shared by new replies and "Just answer": 'start' (userMessage may be null), tokens, then 'done' — or 'routed' with the converted message via the `route` callback; `after` hook (title, routing log, summary). Generation continues if the client leaves |
| `logRouting(uid, cid, mid, event, mode)` | routingLog.ts | `routingEvents` docs (no message text): answer, debate, propose, run_proposal, just_answer, debate_this, debate_button. Deleted with the account |
| `getMessage(cid, mid)`, `loadMessages(cid, limit, beforeSeq?)` | store.ts | Direct read; history before a message |
- Message fields: `kind: 'debate_proposal'`, `routing: { mode, question, reason }` (kept on coordinator debates for the reason line), `claimedAt` (transient, run claim). Context renders an open proposal as "[Suggested running the panel on this — the user has not run it]".
