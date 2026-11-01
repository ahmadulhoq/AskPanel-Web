# Module: app/api/conversations (v2 M1, 2026-10-31)

| Route | File | Responsibility |
|---|---|---|
| `POST /api/conversations` | route.ts | Creates `{ userId, title: null, createdAt, updatedAt }`; returns `{ conversationId }` |
| `POST /api/conversations/[cid]/messages` | [cid]/messages/route.ts | Body `{ content (1–4000 chars), mode: 'reply' \| 'debate' }`. **debate**: `createPanel()` with `debateContext(history)` (402 at the free limit), then writes the user message + an assistant `kind: 'debate'` message, returns `{ messages }` JSON. **reply**: `reserveReply()` (429 at the daily cap), writes user + `streaming` assistant message, streams `ReplyStreamEvent`s (start/token/done/error) as SSE from the POST. Generation is detached from the connection — it completes and saves even if the client leaves. Titles the conversation after its first message. |
| `POST /api/conversations/[cid]/debates` | [cid]/debates/route.ts | "Debate this": body `{ messageId }` of an assistant text reply → debates the nearest preceding user message, with the conversation before it as context; appends a debate message |

## Notes
- Debates started from a conversation are `isPublic: false` (sharing for conversations is an open decision, spec §13.4).
- All of it is verified end to end in a browser (see RULES.md "End-to-end verification").
- 2026-11-01 (BL-048): both routes accept `settings: { persona, maxRounds }` (sanitized; stored as `conversation.debateSettings` when sent) and pass them to `createPanel`. Replies load `REPLY_LOAD_MESSAGES` (80), send `replyHistory()` + the rolling summary, and call `updateSummary()` after the reply is saved. "Debate this" uses the summary only when the debated question is newer than it (otherwise the summary would describe later turns).

- 2026-11-01 (BL-040): `DELETE /api/conversations/[cid]` (`deleteConversation`). Replies: rate limit counted in the same transaction as `reserveReply`.

- 2026-11-01 (BL-042): `POST …/messages` (Enter) lets the reply model route: Pro → `createPanel` with the model's mode + conversation persona/rounds, message becomes `kind: 'debate'` with `routing` (on failure to mark it, the debate is stopped; on 402/429, falls back to a proposal); free → `kind: 'debate_proposal'`. `POST …/messages/[mid]/run` (claims the proposal in a transaction, `createPanel`, message → debate). `POST …/messages/[mid]/answer` ("Just answer": stop the debate — 409 if it already completed — claim the message in a transaction, detach the panel's `messageId`, stream a direct reply via `respond`, update the summary). `lib/panels/errors.ts` `panelErrorResponse(err)` maps createPanel's 402/429 in all four creating routes.
- 2026-11-01 (BL-051): messages (debate + coordinator auto-start), debates and run routes pass `body.options` to `createPanel` (sanitized there; used only in compare mode).
