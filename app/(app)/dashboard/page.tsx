import Link from 'next/link'
import { Lock } from 'lucide-react'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { QuestionComposer } from '@/components/dashboard/QuestionComposer'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { Badge } from '@/components/ui/badge'
import { ConfidenceBadge } from '@/components/panel/ConfidenceBadge'
import type { PanelDoc, ConfidenceLevel } from '@/types'

export const metadata = { title: 'Dashboard — AskPanel' }

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
  const tier = userData?.subscription?.tier ?? 'free'
  const freeRunsUsed = userData?.freeRunsUsed ?? 0

  const panelsSnap = await db
    .collection('panels')
    .where('userId', '==', user.uid)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get()

  const panels = panelsSnap.docs.map(d => ({ id: d.id, ...(d.data() as PanelDoc) }))

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-bold">AskPanel</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {tier === 'free' ? (
            <span>{5 - freeRunsUsed} free run{5 - freeRunsUsed !== 1 ? 's' : ''} remaining</span>
          ) : (
            <Badge variant="default">Pro</Badge>
          )}
          <SignOutButton />
        </div>
      </div>

      {upgraded === '1' && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
          You're now on Pro. Enjoy unlimited panel runs.
        </div>
      )}

      <section className="mb-10">
        <QuestionComposer />
      </section>

      {panels.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Recent panels
          </h2>
          <ul className="space-y-2">
            {panels.map(panel => (
              <li key={panel.id}>
                <Link
                  href={`/panel/${panel.id}`}
                  className="flex items-start justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-2 mr-4">
                    {!panel.isPublic && (
                      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Private" />
                    )}
                    <p className="text-sm line-clamp-2">
                      {panel.title ?? panel.question}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {panel.status === 'complete' && panel.confidence && (
                      <ConfidenceBadge level={panel.confidence as ConfidenceLevel} />
                    )}
                    {panel.status === 'running' && (
                      <Badge variant="secondary">Running</Badge>
                    )}
                    {panel.status === 'error' && (
                      <Badge variant="destructive">Error</Badge>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
