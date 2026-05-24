'use client'

import { useEffect, useReducer, useRef } from 'react'
import type { SSEEvent, PanelState, AgentTurnState, SynthesisState } from '@/types'

type Action = SSEEvent | { type: 'reset' }

function reducer(state: PanelState, action: Action): PanelState {
  if (action.type === 'reset') {
    return initialState()
  }

  switch (action.type) {
    case 'agent_start': {
      const turn: AgentTurnState = {
        agent: action.agent,
        round: action.round,
        content: '',
        streaming: true,
      }
      return { ...state, status: 'running', turns: [...state.turns, turn] }
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
        const isTarget = t.agent === action.agent && t.round === action.round && t.streaming
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
      }
      return { ...state, syntheses: [...state.syntheses, synthesis] }
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
      return { ...state, status: 'error', errorMessage: action.message }
    }

    default:
      return state
  }
}

function initialState(): PanelState {
  return {
    status: 'idle',
    turns: [],
    syntheses: [],
    finalAnswer: null,
    confidence: null,
    errorMessage: null,
  }
}

export function usePanel(panelId: string | null) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!panelId) return

    dispatch({ type: 'reset' })

    const es = new EventSource(`/api/panels/${panelId}/stream`)
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as SSEEvent
        dispatch(event)
        if (event.type === 'panel_complete' || event.type === 'error') {
          es.close()
        }
      } catch {
        // malformed event — ignore
      }
    }

    es.onerror = () => {
      dispatch({ type: 'error', message: 'Connection lost. Please refresh.' })
      es.close()
    }

    return () => {
      es.close()
    }
  }, [panelId])

  return state
}
