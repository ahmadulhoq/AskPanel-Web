import { diffPanel, newCursor, type PanelView } from './streamDiff'
import { initialPanelState, panelReducer } from './panelState'
import type { PanelState } from '@/types'

// The thread state for a stored panel, built the same way a live viewer builds it.
export function stateFromPanel(panel: PanelView): PanelState {
  return diffPanel(newCursor(), panel).reduce(panelReducer, initialPanelState())
}
