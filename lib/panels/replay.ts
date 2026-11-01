import { diffPanel, newCursor, type PanelView } from './streamDiff.ts'
import { initialPanelState, panelReducer } from './panelState.ts'
import type { PanelState } from '@/types'

// The thread state for a stored panel, built the same way a live viewer builds it.
// (Pure; .ts imports so node:test can load it.)
export function stateFromPanel(panel: PanelView): PanelState {
  return diffPanel(newCursor(), panel).reduce(panelReducer, initialPanelState())
}
