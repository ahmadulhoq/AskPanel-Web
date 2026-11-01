import type { Timestamp } from 'firebase/firestore'

export type SubscriptionTier = 'free' | 'pro'
export type PanelStatus = 'queued' | 'running' | 'complete' | 'error'
export type AgentRole = 'respondent' | 'critic' | 'proposer'
// 'critique' (absent on older panels): Respondent ↔ Critic rounds + Synthesizer.
// 'compare': Proposers each put forward an option, a Critic tests them, a Judge picks one.
export type PanelMode = 'critique' | 'compare'
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

export interface CompareScore {
  option: number // 1-based
  score: number // 1–10
  summary: string
}

export interface CompareJudgement {
  winner: number // 1-based option number
  scores: CompareScore[]
  reasoning: string
  confidence: ConfidenceLevel
}

// Progress of a compare-mode panel: proposals → critique → (Pro) revisions → judgement.
export interface PanelCompare {
  // Options the user named (2–3): proposer i argues for options[i]. Absent/null: the
  // proposers take them from the question or choose their own (PROPOSER_COUNT).
  options?: string[] | null
  // Pro (BL-051): each proposer revises its option after the critique, before the judge.
  revise?: boolean
  proposals: { content: string }[]
  critic: { content: string } | null
  // Revised proposals (shown as round 2), in proposal order. Only when `revise`.
  revisions?: { content: string }[]
  judgement: CompareJudgement | null
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
  // End of the allowance window the run was counted in (ms); refunds only apply within it.
  runWindowEndsAt?: number
  // Set when the owner pressed Stop (status is then 'error').
  stoppedAt?: number | null
  mode?: PanelMode
  compare?: PanelCompare | null
}

// In-progress agent text, flushed by the runner about once a second.
export interface LiveTurn {
  agent: AgentRole
  round: number
  // Which proposer (0-based), in compare mode.
  index?: number
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
  // Debates in this conversation (shown in the list).
  debateCount?: number
  // Set on conversations created from v1 panels.
  migratedFrom?: 'v1'
}

// A conversation in the dashboard list.
export interface ConversationSummary {
  id: string
  title: string | null
  updatedAt: number // ms
  debateCount: number
}

export interface DebateSettings {
  persona: string
  maxRounds: number
  mode: PanelMode
}

// 'debate_proposal': the assistant suggested a debate (free tier) — Run it or Just answer.
export type MessageKind = 'text' | 'debate' | 'debate_proposal'

// Why the assistant routed a message to the panel (set when the coordinator decided).
export interface MessageRouting {
  mode: PanelMode
  question: string
  reason: string
}
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
  routing?: MessageRouting | null
  // User messages: context the user attached (pasted, or extracted from a link or file).
  context?: string | null
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
  debate: { status: PanelStatus; finalAnswer: string | null; confidence: ConfidenceLevel | null; stopped?: boolean; isPublic?: boolean } | null
  routing: MessageRouting | null
  context: string | null
}

// Events streamed by POST /api/conversations/[cid]/messages for a quick reply.
export type ReplyStreamEvent =
  | { type: 'start'; userMessage: MessageView | null; assistantMessage: MessageView }
  | { type: 'token'; text: string }
  // The assistant sent the message to the panel instead: a debate, or a proposal to run one.
  | { type: 'routed'; message: MessageView }
  | { type: 'done' }
  | { type: 'error'; message: string }

// SSE event types
export type SSEEvent =
  | { type: 'agent_start'; agent: AgentRole; round: number; index?: number }
  | { type: 'agent_token'; agent: AgentRole; index?: number; token: string }
  | { type: 'agent_complete'; agent: AgentRole; round: number; index?: number; content: string }
  | { type: 'synthesis_start'; round: number }
  | { type: 'synthesis_result'; round: number; decision: SynthesisDecision; confidence: ConfidenceLevel; reasoning: string; issuesFound: number }
  | ({ type: 'compare_result' } & CompareJudgement)
  | { type: 'panel_complete'; finalAnswer: string; confidence: ConfidenceLevel }
  | { type: 'error'; message: string }

// Client-side panel state (built from SSE events)
export interface AgentTurnState {
  agent: AgentRole
  round: number
  index?: number
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
  comparison: CompareJudgement | null
  // A verdict is being produced (synthesis_start seen, result not yet in).
  verdictPending: boolean
  finalAnswer: string | null
  confidence: ConfidenceLevel | null
  errorMessage: string | null
}

// A panel in the dashboard list (plain values; no Timestamps cross to the client).
export interface PanelSummary {
  id: string
  question: string
  title: string | null
  persona: string
  personaLabel: string | null
  status: PanelStatus
  isPublic: boolean
  parentPanelId: string | null
  confidence: ConfidenceLevel | null
}
