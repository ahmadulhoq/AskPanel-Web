import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planMigration, migratedIds } from './migratePlan.ts'

test('follow-up chains become one conversation, oldest first; others stand alone', () => {
  const plan = planMigration([
    { id: 'c', parentPanelId: 'b', createdAt: 3 },
    { id: 'a', parentPanelId: null, createdAt: 1 },
    { id: 'b', parentPanelId: 'a', createdAt: 2 },
    { id: 'x', parentPanelId: null, createdAt: 5 },
    { id: 'y', parentPanelId: 'gone', createdAt: 6 }, // parent not in the set
  ])
  assert.deepEqual(plan, [
    { rootId: 'a', panelIds: ['a', 'b', 'c'] },
    { rootId: 'x', panelIds: ['x'] },
    { rootId: 'y', panelIds: ['y'] },
  ])
})

test('a parent cycle does not loop forever', () => {
  const plan = planMigration([
    { id: 'p', parentPanelId: 'q', createdAt: 1 },
    { id: 'q', parentPanelId: 'p', createdAt: 2 },
  ])
  assert.equal(plan.reduce((n, c) => n + c.panelIds.length, 0), 2)
})

test('ids are deterministic per panel', () => {
  assert.deepEqual(migratedIds('a', 'b'), { conversationId: 'v1-a', userMessageId: 'v1-q-b', assistantMessageId: 'v1-a-b' })
})
