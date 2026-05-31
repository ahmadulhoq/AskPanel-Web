import { type NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import type { PanelDoc } from '@/types'

function formatMarkdown(panel: PanelDoc, panelId: string): string {
  const lines: string[] = []

  const date = panel.completedAt
    ? new Date((panel.completedAt as unknown as { toMillis(): number }).toMillis())
        .toISOString()
        .slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  lines.push(`# ${panel.title ?? panel.question}`)
  lines.push('')
  if (panel.title) {
    lines.push(`**Question:** ${panel.question}`)
  }
  lines.push(`**Persona:** ${panel.persona ?? 'general'}`)
  lines.push(`**Date:** ${date}`)
  lines.push(`**Confidence:** ${panel.confidence ?? 'unknown'}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  const rounds = panel.rounds ?? []
  for (let i = 0; i < rounds.length; i++) {
    const round = rounds[i]
    const roundNum = round.roundNumber

    if (rounds.length > 1) {
      lines.push(`## Round ${roundNum}`)
      lines.push('')
    }

    if (round.respondent) {
      lines.push('### Respondent')
      lines.push('')
      lines.push(round.respondent.content)
      lines.push('')
    }

    if (round.critic) {
      lines.push('### Critic')
      lines.push('')
      lines.push(round.critic.content)
      lines.push('')
    }

    if (round.synthesizer) {
      lines.push('### Synthesis')
      lines.push('')
      lines.push(
        `**Decision:** ${round.synthesizer.decision} | **Issues found:** ${round.synthesizer.issuesFound}`,
      )
      lines.push('')
      lines.push(round.synthesizer.reasoning)
      lines.push('')
    }

    if (i < rounds.length - 1) {
      lines.push('---')
      lines.push('')
    }
  }

  if (panel.finalAnswer) {
    lines.push('---')
    lines.push('')
    lines.push('## Final Answer')
    lines.push('')
    lines.push(panel.finalAnswer)
    lines.push('')
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://askpanel.app'
  lines.push('---')
  lines.push('')
  lines.push(`*Exported from [AskPanel](${appUrl}) — Panel ID: \`${panelId}\`*`)

  return lines.join('\n')
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ panelId: string }> },
) {
  const { panelId } = await params
  const user = await getSessionUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const db = adminDb()
  const snap = await db.collection('panels').doc(panelId).get()
  if (!snap.exists) {
    return new Response('Not Found', { status: 404 })
  }

  const panel = snap.data() as PanelDoc
  if (panel.userId !== user.uid) {
    return new Response('Forbidden', { status: 403 })
  }

  if (panel.status !== 'complete') {
    return new Response('Panel not yet complete', { status: 409 })
  }

  const markdown = formatMarkdown(panel, panelId)
  const filename = `panel-${panelId}.md`

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
