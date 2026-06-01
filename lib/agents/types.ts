import type { SSEEvent, PanelConfig } from '@/types'

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
}

export type SSEGenerator = AsyncGenerator<SSEEvent, void, unknown>
