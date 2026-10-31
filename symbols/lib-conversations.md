# Module: lib/conversations (v2 M1, 2026-10-31)

**Responsibility:** Conversation storage, model context, quick-reply generation, titles.

| Name | File | Responsibility |
|---|---|---|
| `conversationRef(cid)` / `messagesRef(cid)` | store.ts | `conversations/{cid}` and its `messages` subcollection |
| `getOwnedConversation(cid, uid)` | store.ts | Ownership check; null if missing or not the user's |
| `NewMessage` / `toMessageView(id, m, debate)` | store.ts | Message without `createdAt` (added at write as serverTimestamp) / plain view for the client. A reply still `streaming` after 5 min reads as `error`. |
| `loadMessages(cid, limit)` | store.ts | Latest messages by `seq`, oldest first, each debate joined with its panel's status/finalAnswer/confidence (`getAll`) |
| `nextSeq(history)` | store.ts | Ordering key: wall-clock ms, strictly after the last message |
| `toModelMessages(history, maxChars)` | context.ts | Pure (tested). Alternating Anthropic messages starting with user; debate verdicts as `[Panel verdict — confidence: …]` assistant turns; running/failed debates described, never invented; failed empty replies dropped; trimmed oldest-first (~24k chars) keeping the newest turn |
| `debateContext(history, maxChars)` | context.ts | Pure (tested). "Earlier in this conversation:" brief (User/Assistant/Panel verdict lines, newest kept, ~3.5k chars) passed to `createPanel` as `userContext` |
| `streamReply(messages)` | reply.ts | Streams a quick reply (DEFAULT_MODEL, cached system prompt: answer directly, suggest Debate for trade-offs, never claim a debate happened) |
| `titleConversation(cid, firstMessage)` | title.ts | Names a conversation via `generateTitle()`; best effort |
