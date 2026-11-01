// v1 → v2 migration plan (spec §10), pure so it can be tested. Each v1 panel becomes a
// debate in a conversation; a parentPanelId chain (follow-ups) becomes one conversation,
// oldest first. Panels whose parent isn't among the user's unmigrated panels start their
// own conversation.

export interface MigratablePanel {
  id: string
  parentPanelId: string | null
  createdAt: number // ms
}

export interface PlannedConversation {
  rootId: string
  panelIds: string[] // oldest first
}

export function planMigration(panels: MigratablePanel[]): PlannedConversation[] {
  const byId = new Map(panels.map((p) => [p.id, p]))
  const rootOf = (p: MigratablePanel) => {
    const seen = new Set<string>()
    let current = p
    while (current.parentPanelId && byId.has(current.parentPanelId) && !seen.has(current.id)) {
      seen.add(current.id)
      current = byId.get(current.parentPanelId)!
    }
    return current.id
  }
  const groups = new Map<string, MigratablePanel[]>()
  for (const p of panels) {
    const root = rootOf(p)
    groups.set(root, [...(groups.get(root) ?? []), p])
  }
  return [...groups.entries()]
    .map(([rootId, members]) => ({
      rootId,
      panelIds: members.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)).map((p) => p.id),
    }))
    .sort((a, b) => a.rootId.localeCompare(b.rootId))
}

// Deterministic ids, so running the migration again rewrites the same docs.
export const migratedIds = (rootId: string, panelId: string) => ({
  conversationId: `v1-${rootId}`,
  userMessageId: `v1-q-${panelId}`,
  assistantMessageId: `v1-a-${panelId}`,
})
