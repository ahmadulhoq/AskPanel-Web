# AskPanel MCP server

AskPanel exposes its debate panel as a remote [MCP](https://modelcontextprotocol.io) server,
so AI tools such as Claude Code and Cursor can stress-test a decision without leaving the
editor. Debates started this way count against the user's plan and appear in their
conversation list.

- **Endpoint:** `https://askpanel.app/api/mcp` (Streamable HTTP, POST only, stateless)
- **Auth:** a personal API token from the Account page, sent as `Authorization: Bearer ap_…`.
  Tokens are stored as SHA-256 hashes, can be revoked at any time, and are limited to 5 per user.
- **Protocol:** dual-era — modern clients (`2026-07-28`, version in each request's `_meta`,
  `server/discover`) and legacy clients (`2025-11-25`, `2025-06-18`, `2025-03-26`, with the
  `initialize` handshake) are both served. No sessions, no server-initiated messages.
- **Rate limit:** 120 messages a minute per user (each message in a batch counts; batches are capped at 5), plus the usual debate limits.

## Tools

| Tool | Arguments | Returns |
|---|---|---|
| `start_debate` | `question` (10–4000 chars, self-contained), `mode` (`critique` \| `compare`), `persona`, `rounds` (1–3), `context` (≤4000 chars) | Immediately: `debate_id`, `status: "queued"`, `url` of the conversation |
| `get_debate_result` | `debate_id`, `wait_seconds` (0–25, default 20) | `status` (`queued` \| `running` \| `complete` \| `error`); when complete: `final_answer`, `confidence`, `transcript_url`, and for compare mode `winner` + `scores` |

Debates take one to three minutes: call `get_debate_result` again while the status is
`running`. Plan limits come back as tool errors (`isError: true`) with a readable message.

## Setup

**Claude Code**

```sh
claude mcp add --transport http askpanel https://askpanel.app/api/mcp \
  --header "Authorization: Bearer ap_your_token"
```

**Cursor** (`~/.cursor/mcp.json`) and other clients that take a URL and headers:

```json
{
  "mcpServers": {
    "askpanel": {
      "url": "https://askpanel.app/api/mcp",
      "headers": { "Authorization": "Bearer ap_your_token" }
    }
  }
}
```

## Not yet

OAuth (so users can connect without copying a token) is the next step; see the backlog.

## Code

`app/api/mcp/route.ts` (HTTP + auth) → `lib/mcp/protocol.ts` (JSON-RPC, version handling,
tested) → `lib/mcp/tools.ts` (the two tools). Tokens: `lib/mcp/tokens.ts`,
`lib/mcp/tokenFormat.ts`; UI in `components/account/ApiTokens.tsx`.
