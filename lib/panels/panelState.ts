import type { SSEEvent, PanelState, AgentTurnState, SynthesisState } from '@/types'

// Client-side panel state, built by replaying SSE events. Pure: shared by the live thread
// (usePanel) and the share page, which replays a stored panel through diffPanel.
export type PanelAction = SSEEvent | { type: 'reset' }

export function panelReducer(state: PanelState, action: PanelAction): PanelState {
  if (action.type === 'reset') {
    return initialPanelState()
  }

  switch (action.type) {
    case 'agent_start': {
      const turn: AgentTurnState = {
        agent: action.agent,
        round: action.round,
        ...(action.index !== undefined ? { index: action.index } : {}),
        content: '',
        streaming: true,
      }
      // A resumed run regenerates an unfinished turn; replace it rather than duplicating it.
      const existing = state.turns.findIndex(
        (t) => t.agent === action.agent && t.round === action.round && t.index === action.index && t.streaming,
      )
      const turns = existing === -1
        ? [...state.turns, turn]
        : state.turns.map((t, i) => (i === existing ? turn : t))
      return { ...state, status: 'running', turns }
    }

    case 'agent_token': {
      const turns = state.turns.map((t) => {
        const isTarget =
          t.agent === action.agent && t.streaming
        return isTarget ? { ...t, content: t.content + action.token } : t
      })
      return { ...state, turns }
    }

    case 'agent_complete': {
      const turns = state.turns.map((t) => {
        const isTarget = t.agent === action.agent && t.round === action.round && t.index === action.index && t.streaming
        return isTarget ? { ...t, content: action.content, streaming: false } : t
      })
      return { ...state, turns }
    }

    case 'synthesis_result': {
      const synthesis: SynthesisState = {
        round: action.round,
        decision: action.decision,
        confidence: action.confidence,
        reasoning: action.reasoning,
        issuesFound: action.issuesFound ?? 0,
      }
      return { ...state, syntheses: [...state.syntheses, synthesis] }
    }

    case 'compare_result': {
      const { winner, scores, reasoning, confidence } = action
      return { ...state, comparison: { winner, scores, reasoning, confidence } }
    }

    case 'panel_complete': {
      return {
        ...state,
        status: 'complete',
        finalAnswer: action.finalAnswer,
        confidence: action.confidence,
      }
    }

    case 'error': {
      // A stopped or failed run leaves its unfinished turn as it was, not "still typing".
      const turns = state.turns.map((t) => (t.streaming ? { ...t, streaming: false } : t))
      return { ...state, status: 'error', errorMessage: action.message, turns }
    }

    default:
      return state
  }
}

export function initialPanelState(): PanelState {
  return {
    status: 'idle',
    turns: [],
    syntheses: [],
    comparison: null,
    finalAnswer: null,
    confidence: null,
    errorMessage: null,
  }
}
