# Module: components/chat (v2 M1, 2026-10-31)

| Name | File | Responsibility |
|---|---|---|
| `ChatComposer` | ChatComposer.tsx | Auto-grow textarea; Enter = quick reply, "Debate" button = run the panel on the message; `onSubmit` resolves true to clear the input |
| `AssistantReply` | AssistantReply.tsx | Streamdown reply with typing indicator, failure note, Copy and "Debate this" |
| `DebateBlock` | DebateBlock.tsx | A debate inside the thread: expanded + live while running (PanelThread with `showFollowUp={false}`), collapsed to verdict + confidence when done; "Show/Hide debate", "Full transcript" link |
| `ConversationView` | ConversationView.tsx | Client state for a conversation: sends (reply streams via fetch + `drainSSE`, debate returns JSON), "Debate this", 402 → PaywallDialog, errors inline; sends the URL-handed first message once after `router.replace` removes it; `ThreadScroller followKey={messages.length}` |
| `NewConversation` | NewConversation.tsx | /chat composer: creates a conversation, navigates to `/chat/[cid]?q=…&mode=…` |

Pages: `app/(app)/chat/page.tsx` (list + new), `app/(app)/chat/[cid]/page.tsx` (server-loads messages, passes `pending` only for an empty conversation). Helper: `lib/sse/parse.ts` `drainSSE()` (tested).
