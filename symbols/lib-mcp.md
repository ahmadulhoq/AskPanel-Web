# Module: lib/mcp (2026-11-01, BL-045 — spec §11)

**Responsibility:** AskPanel as a remote MCP server: protocol core, tools, personal API tokens. Docs: `docs/mcp.md`.

| Name | File | Responsibility |
|---|---|---|
| `handleMessage(server, message)` | protocol.ts | Pure (tested) dual-era JSON-RPC: modern (2026-07-28: `_meta['io.modelcontextprotocol/protocolVersion']`, `server/discover`, `resultType: 'complete'`, `_meta` serverInfo, `ttlMs`/`cacheScope` on lists, `UnsupportedProtocolVersion` -32022 with `{supported, requested}`) and legacy (`initialize` negotiates 2025-11-25/06-18/03-26, `ping`, notifications → no reply). `tools/call` errors become `isError` results |
| `SUPPORTED_VERSIONS`, `ERRORS`, `McpServer`, `ToolResult` | protocol.ts | |
| `askPanelServer(uid, signal?)` | tools.ts | Tools `start_debate` (writes conversation + question first, then `createPanel` with conversationId/messageId, then the debate message — removed/stopped on failure; plan limits → isError text) and `get_debate_result` (kicks `runPanelJob` to resume, waits ≤25s via `onSnapshot`, abort-aware; complete → final answer, confidence, compare winner/scores, links) |
| `newToken`, `hashToken`, `isTokenShaped`, `tokenHint`, `bearerToken` | tokenFormat.ts | Pure (tested): `ap_` + 32 base64url; SHA-256 hex id |
| `createApiToken`, `listApiTokens`, `revokeApiToken`, `verifyApiToken`, `MAX_TOKENS` (5), `TokenLimitError` | tokens.ts | `apiTokens/{sha256}` {uid, name, hint, createdAt, lastUsedAt}; cap enforced in a transaction; verify also requires the Auth user to exist, be enabled, and not have revoked sessions after the token's creation (60s per-instance cache); lastUsedAt touched ≤ every 10 min |

Routes: `POST /api/mcp` (Bearer token → 401 otherwise; each message counts against `LIMITS.mcp` 120/min; batches ≤5, extra entries get -32600; empty batch 400; 202 for notification-only; GET/DELETE 405). `GET/POST /api/account/tokens`, `DELETE /api/account/tokens/[id]`. UI: `components/account/ApiTokens.tsx` on /account ("Connect AI tools (MCP)"). Tokens deleted with the account.
- 2026-11-01 (BL-051): `start_debate` accepts `options` (2–3 strings, compare mode) → `createPanel`.
