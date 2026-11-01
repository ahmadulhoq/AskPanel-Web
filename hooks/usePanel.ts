'use client'

import { useEffect, useReducer } from 'react'
import { panelReducer, initialPanelState } from '@/lib/panels/panelState'
import type { SSEEvent } from '@/types'

const MAX_RECONNECTS = 5
// Shown when this page gave up reconnecting. The debate itself may still be running.
export const CONNECTION_LOST_MESSAGE = 'Connection lost. Please refresh.'

export function usePanel(panelId: string | null) {
  const [state, dispatch] = useReducer(panelReducer, undefined, initialPanelState)

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
          dispatch({ type: 'error', message: CONNECTION_LOST_MESSAGE })
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
