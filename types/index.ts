import type { Timestamp } from 'firebase/firestore'

export type SubscriptionTier = 'free' | 'pro'
export type PanelStatus = 'queued' | 'running' | 'complete' | 'error'
export type AgentRole = 'respondent' | 'critic'
export type SynthesisDecision = 'continue' | 'consensus' | 'contested'
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'contested'

export interface CustomPersona {
  label: string
  respondentSystem: string
  criticSystem: string
}

export interface UserSubscription {
  tier: SubscriptionTier
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  currentPeriodEnd: Timestamp | null
  // Synced from Stripe by the webhook; absent on users who never subscribed.
  status?: 'active' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'paused' | 'trialing' | 'unpaid' | null
  cancelAtPeriodEnd?: boolean
}

export interface UserDoc {
  email: string
  displayName: string
  photoURL: string | null
  createdAt: Timestamp
  freeRunsUsed: number
  freeRunsResetAt: Timestamp | null
  customPersona: CustomPersona | null
  subscription: UserSubscription
}

export interface RoundSynthesis {
  decision: SynthesisDecision
  reasoning: string
  confidence: ConfidenceLevel
  issuesFound: number
}

export interface PanelRound {
  roundNumber: number
  respondent: { content: string } | null
  critic: { content: string } | null
  synthesizer: RoundSynthesis | null
}

export interface PanelConfig {
  maxRounds: number
  model: string
}

export interface PanelDoc {
  userId: string
  question: string
  title: string | null
  persona: string
  customPersona: CustomPersona | null
  parentPanelId: string | null
  // Set when the debate was started from a conversation (v2).
  conversationId?: string | null
  messageId?: string | null
  context: string | null
  status: PanelStatus
  isPublic: boolean
  createdAt: Timestamp
  completedAt: Timestamp | null
  config: PanelConfig
  rounds: PanelRound[]
  finalAnswer: string | null
  confidence: ConfidenceLevel | null
  errorMessage: string | null
  // Background run state (absent on panels created before background runs).
  live?: LiveTurn | null
  run?: RunLease | null
  runCounted?: boolean
  // Set when the owner pressed Stop (status is then 'error').
  stoppedAt?: number | null
}

// In-progress agent text, flushed by the runner about once a second.
export interface LiveTurn {
  agent: AgentRole
  round: number
  content: string
  runId: string
}

// Only the runner holding the current lease may write a panel's progress.
export interface RunLease {
  id: string
  heartbeatAt: number
}

// v2 conversations: conversations/{cid}, messages in conversations/{cid}/messages/{mid}
export interface ConversationDoc {
  userId: string
  title: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
  // Rolling summary of messages that no longer fit in the reply window (seq <= summarizedThroughSeq).
  summary?: string | null
  summarizedThroughSeq?: number
  // Persona and rounds of the last debate started here; the composer reopens with them.
  debateSettings?: DebateSettings
}

export interface DebateSettings {
  persona: string
  maxRounds: number
}

export type MessageKind = 'text' | 'debate'
export type MessageStatus = 'streaming' | 'complete' | 'error'

export interface MessageDoc {
  role: 'user' | 'assistant'
  kind: MessageKind
  content: string
  // kind = 'debate': the panel running the debate; its verdict lives on the panel.
  panelId: string | null
  status: MessageStatus
  // Ordering key (ms); assistant replies get user seq + 1.
  seq: number
  createdAt: Timestamp
}

// What the chat UI receives for each message (no Timestamps across the RSC boundary).
export interface MessageView {
  id: string
  role: 'user' | 'assistant'
  kind: MessageKind
  content: string
  status: MessageStatus
  seq: number
  panelId: string | null
  debate: { status: PanelStatus; finalAnswer: string | null; confidence: ConfidenceLevel | null; stopped?: boolean } | null
}

// Events streamed by POST /api/conversations/[cid]/messages for a quick reply.
export type ReplyStreamEvent =
  | { type: 'start'; userMessage: MessageView; assistantMessage: MessageView }
  | { type: 'token'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

// SSE event types
export type SSEEvent =
  | { type: 'agent_start'; agent: AgentRole; round: number }
  | { type: 'agent_token'; agent: AgentRole; token: string }
  | { type: 'agent_complete'; agent: AgentRole; round: number; content: string }
  | { type: 'synthesis_start'; round: number }
  | { type: 'synthesis_result'; round: number; decision: SynthesisDecision; confidence: ConfidenceLevel; reasoning: string; issuesFound: number }
  | { type: 'panel_complete'; finalAnswer: string; confidence: ConfidenceLevel }
  | { type: 'error'; message: string }

// Client-side panel state (built from SSE events)
export interface AgentTurnState {
  agent: AgentRole
  round: number
  content: string
  streaming: boolean
}

export interface SynthesisState {
  round: number
  decision: SynthesisDecision
  confidence: ConfidenceLevel
  reasoning: string
  issuesFound: number
}

export interface PanelState {
  status: 'idle' | 'running' | 'complete' | 'error'
  turns: AgentTurnState[]
  syntheses: SynthesisState[]
  finalAnswer: string | null
  confidence: ConfidenceLevel | null
  errorMessage: string | null
}
