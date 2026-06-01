import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { QuestionComposer } from '@/components/dashboard/QuestionComposer'
import { PanelList } from '@/components/dashboard/PanelList'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { Badge } from '@/components/ui/badge'
import { PERSONA_MAP } from '@/lib/agents/personas'
import type { PanelDoc } from '@/types'
import type { PanelSummary } from '@/components/dashboard/PanelList'

export const metadata = { title: 'Dashboard — AskPanel' }

function formatResetDate(timestamp: { toMillis(): number } | null | undefined): string | null {
  if (!timestamp) return null
  const d = new Date(timestamp.toMillis())
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>
}) {
  const { upgraded } = await searchParams
  const user = await getSessionUser()
  if (!user) return null

  const db = adminDb()
  const userSnap = await db.collection('users').doc(user.uid).get()
  const userData = userSnap.data()
  const tier = (userData?.subscription?.tier ?? 'free') as 'free' | 'pro'
  const freeRunsUsed = userData?.freeRunsUsed ?? 0
  const resetDate = formatResetDate(userData?.freeRunsResetAt)
  const runsLeft = Math.max(0, 5 - freeRunsUsed)
  const customPersona = userData?.customPersona ?? null

  const panelsSnap = await db
    .collection('panels')
    .where('userId', '==', user.uid)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get()

  // Serialise to plain objects — no Timestamps passed to client components.
  const panels: PanelSummary[] = panelsSnap.docs.map(d => {
    const data = d.data() as PanelDoc
    const isCustom = data.persona === 'custom'
    const personaLabel =
      isCustom
        ? (data.customPersona?.label ?? 'Custom')
        : data.persona !== 'general'
          ? (PERSONA_MAP[data.persona]?.label ?? data.persona)
          : null
    return {
      id: d.id,
      question: data.question,
      title: data.title ?? null,
      persona: data.persona,
      personaLabel,
      status: data.status,
      isPublic: data.isPublic,
      parentPanelId: data.parentPanelId ?? null,
      confidence: data.confidence ?? null,
    }
  })

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-bold">AskPanel</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {tier === 'free' ? (
            <span>
              {runsLeft} free run{runsLeft !== 1 ? 's' : ''} left
              {resetDate && <span className="ml-1 text-xs opacity-70">· resets {resetDate}</span>}
            </span>
          ) : (
            <Badge variant="default">Pro</Badge>
          )}
          <SignOutButton />
        </div>
      </div>

      {upgraded === '1' && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
          You&apos;re now on Pro. Enjoy unlimited panel runs.
        </div>
      )}

      <section className="mb-10">
        <QuestionComposer tier={tier} initialCustomPersona={customPersona} />
      </section>

      <PanelList panels={panels} />
    </main>
  )
}
