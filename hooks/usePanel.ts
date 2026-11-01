'use client'

import { useEffect, useReducer } from 'react'
import type { SSEEvent, PanelState, AgentTurnState, SynthesisState } from '@/types'

type Action = SSEEvent | { type: 'reset' }

const MAX_RECONNECTS = 5

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
      // A resumed run regenerates an unfinished turn; replace it rather than duplicating it.
      const existing = state.turns.findIndex(
        (t) => t.agent === action.agent && t.round === action.round && t.streaming,
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
        issuesFound: action.issuesFound ?? 0,
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
      // A stopped or failed run leaves its unfinished turn as it was, not "still typing".
      const turns = state.turns.map((t) => (t.streaming ? { ...t, streaming: false } : t))
      return { ...state, status: 'error', errorMessage: action.message, turns }
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

  useEffect(() => {
    if (!panelId) return

    let es: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    let finished = false

    // The debate runs on the server regardless of this connection, and every connection
    // replays the full stored state — so a dropped connection is simply reopened.
    const connect = () => {
      let fresh = true
      es = new EventSource(`/api/panels/${panelId}/stream`)

      es.onmessage = (e) => {
        let event: SSEEvent
        try {
          event = JSON.parse(e.data) as SSEEvent
        } catch {
          return // malformed event — ignore
        }
        // Reset on the first event of a connection (not on connect) so the thread
        // doesn't flash empty while reconnecting.
        if (fresh) {
          dispatch({ type: 'reset' })
          fresh = false
        }
        attempts = 0
        dispatch(event)
        if (event.type === 'panel_complete' || event.type === 'error') {
          finished = true
          es?.close()
        }
      }

      es.onerror = () => {
        es?.close()
        if (finished) return
        if (attempts >= MAX_RECONNECTS) {
          dispatch({ type: 'error', message: 'Connection lost. Please refresh.' })
          return
        }
        attempts++
        retryTimer = setTimeout(connect, Math.min(1000 * 2 ** attempts, 15_000))
      }
    }

    connect()

    return () => {
      finished = true
      clearTimeout(retryTimer)
      es?.close()
    }
  }, [panelId])

  return state
}
