import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { NewConversation } from '@/components/chat/NewConversation'
import { ConversationList } from '@/components/dashboard/ConversationList'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { listConversations } from '@/lib/conversations/list'
import { migrateUserPanels } from '@/lib/conversations/migrate'
import { allowance } from '@/lib/billing/runs'

export const metadata = { title: 'Dashboard — AskPanel' }

const formatResetDate = (ms: number | null) =>
  ms === null ? null : new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

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
  const { left: runsLeft, resetAt } = allowance(userData)
  const resetDate = formatResetDate(resetAt)
  const customPersona = userData?.customPersona ?? null

  // Panels not in a conversation yet (v1 panels, or ones started outside chat) are put into
  // conversations first, so the list shows everything. Cheap once done.
  await migrateUserPanels(user.uid, Boolean(userData?.v1MigratedAt))
    .catch((err) => console.error('[dashboard] migration failed', user.uid, err))
  const { conversations, next } = await listConversations(user.uid)

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-bold">AskPanel</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {tier === 'free' ? (
            <span>
              {runsLeft} free debate{runsLeft !== 1 ? 's' : ''} left
              {resetDate && <span className="ml-1 text-xs opacity-70">· resets {resetDate}</span>}
            </span>
          ) : (
            <>
              {/* Pro's 100 a month: only worth showing once it's running low. */}
              {runsLeft <= 10 && (
                <span>
                  {runsLeft} debate{runsLeft !== 1 ? 's' : ''} left
                  {resetDate && <span className="ml-1 text-xs opacity-70">· resets {resetDate}</span>}
                </span>
              )}
              <Badge variant="default">Pro</Badge>
            </>
          )}
          <Link href="/account">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              Account
            </Button>
          </Link>
          <SignOutButton />
        </div>
      </div>

      {upgraded === '1' && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
          You&apos;re now on Pro: 100 debates a month, every persona, and context for your debates.
        </div>
      )}

      <section className="mb-10">
        <NewConversation tier={tier} initialCustomPersona={customPersona} />
      </section>

      <ConversationList initialConversations={conversations} initialNext={next} />
    </main>
  )
}
