import type { SSEEvent, PanelConfig, PanelRound } from '@/types'

export interface ConversationTurn {
  role: 'respondent' | 'critic' | 'synthesizer'
  content: string
  round: number
}

export interface OrchestratorInput {
  panelId: string
  question: string
  config: PanelConfig
  persona?: string
  context?: string
  customPersona?: { label: string; respondentSystem: string; criticSystem: string }
  // Rounds already stored for this panel; the run resumes after the last completed step.
  rounds?: PanelRound[]
  // Every write is checked against this lease so a stale runner can't overwrite a newer one.
  leaseId?: string
}

export type SSEGenerator = AsyncGenerator<SSEEvent, void, unknown>
