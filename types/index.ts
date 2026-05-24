import type { Timestamp } from 'firebase/firestore'

export type SubscriptionTier = 'free' | 'pro'
export type PanelStatus = 'queued' | 'running' | 'complete' | 'error'
export type AgentRole = 'respondent' | 'critic'
export type SynthesisDecision = 'continue' | 'consensus' | 'contested'
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'contested'

export interface UserSubscription {
  tier: SubscriptionTier
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  currentPeriodEnd: Timestamp | null
}

export interface UserDoc {
  email: string
  displayName: string
  photoURL: string | null
  createdAt: Timestamp
  freeRunsUsed: number
  subscription: UserSubscription
}

export interface RoundSynthesis {
  decision: SynthesisDecision
  reasoning: string
  confidence: ConfidenceLevel
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
  status: PanelStatus
  isPublic: boolean
  createdAt: Timestamp
  completedAt: Timestamp | null
  config: PanelConfig
  rounds: PanelRound[]
  finalAnswer: string | null
  confidence: ConfidenceLevel | null
  errorMessage: string | null
}

// SSE event types
export type SSEEvent =
  | { type: 'agent_start'; agent: AgentRole; round: number }
  | { type: 'agent_token'; agent: AgentRole; token: string }
  | { type: 'agent_complete'; agent: AgentRole; round: number; content: string }
  | { type: 'synthesis_start'; round: number }
  | { type: 'synthesis_result'; round: number; decision: SynthesisDecision; confidence: ConfidenceLevel; reasoning: string }
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
}

export interface PanelState {
  status: 'idle' | 'running' | 'complete' | 'error'
  turns: AgentTurnState[]
  syntheses: SynthesisState[]
  finalAnswer: string | null
  confidence: ConfidenceLevel | null
  errorMessage: string | null
}
