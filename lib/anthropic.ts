import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  }
  return _client
}

// Debates, replies and the coordinator. Claude Sonnet 5.5 thinks by default (thinking counts
// toward max_tokens) and rejects a forced tool_choice ("any"/"tool") with a 400 — tool calls
// use tool_choice "auto" with strict schemas and a prompt instruction instead.
export const DEFAULT_MODEL = 'claude-sonnet-5-5'

// Small background jobs: conversation titles and running summaries (BL-047 decision).
// Run with thinking disabled (allowed on Claude Haiku 5.5 at effort high or below).
export const LIGHT_MODEL = 'claude-haiku-5-5'
