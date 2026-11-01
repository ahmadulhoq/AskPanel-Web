# Module: components/chat (v2 M1, 2026-10-31)

| Name | File | Responsibility |
|---|---|---|
| `ChatComposer` | ChatComposer.tsx | Auto-grow textarea; Enter = quick reply, "Debate" button = run the panel on the message; `onSubmit` resolves true to clear the input |
| `AssistantReply` | AssistantReply.tsx | Streamdown reply with typing indicator, failure note, Copy and "Debate this" |
| `DebateBlock` | DebateBlock.tsx | A debate inside the thread: expanded + live while running (PanelThread with `showFollowUp={false}`), collapsed to verdict + confidence when done; "Show/Hide debate", "Full transcript" link |
| `ConversationView` | ConversationView.tsx | Client state for a conversation: sends (reply streams via fetch + `drainSSE`, debate returns JSON), "Debate this", 402 → PaywallDialog, errors inline; sends the URL-handed first message once after `router.replace` removes it; `ThreadScroller followKey={messages.length}` |
| `NewConversation` | NewConversation.tsx | /chat composer: creates a conversation, navigates to `/chat/[cid]?q=…&mode=…` |

Pages: `app/(app)/chat/page.tsx` (list + new), `app/(app)/chat/[cid]/page.tsx` (server-loads messages, passes `pending` only for an empty conversation). Helper: `lib/sse/parse.ts` `drainSSE()` (tested).

2026-11-01 (BL-048):
- `ChatComposer` takes `settings?: { label, panel }` — a "General · 2 rounds" chip in the toolbar toggles the panel above the input.
- `DebateSettingsPanel` (DebateSettingsPanel.tsx): PersonaSelector + RoundsSelector for chat debates; `debateSettingsLabel(value, customPersona)` builds the chip text.
- `ConversationView` takes `tier`, `initialCustomPersona`, `initialSettings`; sends `settings` with messages and "Debate this". The page derives settings from the URL (first message from /chat) or `conversation.debateSettings`.
- `NewConversation` takes `tier`, `initialCustomPersona`; passes `persona` and `rounds` in the URL with the first message.
- `DebateBlock`: header Stop button while running (`StopButton`; 409 → opens the thread to show the real outcome); `failure` state 'stopped' | 'failed' from the initial view (`debate.stopped`) or live via `PanelThread onError`; labels "Debate stopped" / "Panel debate failed".

- 2026-11-01 (BL-042): `ProposalCard({ routing, disabled, onRun, onAnswer })` ("This looks worth debating", reason, collapsible question, Run the panel / Just answer). `DebateBlock` gains `messageId` (data attribute), `routing` (reason line: "Convening the panel — …" / "The assistant convened the panel — …") and `onAnswerInstead` + `busy` (Just answer while running). `ConversationView`: shared `readReply` SSE reader handles start/token/routed/done/error and in-place restarts; `runProposal`, `answerInstead`. Composer hint: Enter lets the assistant decide; Debate always runs the panel.

- 2026-11-01 (BL-044): `DebateSettingsPanel` includes `ContextInput` (attachment for the next message; chip label adds "· Context attached"); `QuestionBubble` shows a collapsible "Context attached"; `DebateBlock` has `data-panel-id`.
- 2026-11-01 (BL-049): `DebateBlock` shows `ShareDebateButton` (chip) once the verdict is in; `MessageView.debate.isPublic` comes from `loadMessages`.
