import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { BillingPortalButton } from '@/components/account/BillingPortalButton'

export const metadata = { title: 'Account — AskPanel' }

const FREE_RUN_LIMIT = 5

function formatDate(timestamp: { toMillis(): number } | null | undefined): string | null {
  if (!timestamp) return null
  return new Date(timestamp.toMillis()).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function AccountPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const db = adminDb()
  const userSnap = await db.collection('users').doc(user.uid).get()
  const userData = userSnap.data()

  const tier = (userData?.subscription?.tier ?? 'free') as 'free' | 'pro'
  const freeRunsUsed = userData?.freeRunsUsed ?? 0
  const runsLeft = Math.max(0, FREE_RUN_LIMIT - freeRunsUsed)
  const resetDate = formatDate(userData?.freeRunsResetAt)
  const renewalDate = formatDate(userData?.subscription?.currentPeriodEnd)
  const hasStripeCustomer = Boolean(userData?.subscription?.stripeCustomerId)

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-bold">Account</h1>
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            ← Dashboard
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Plan</CardTitle>
            {tier === 'pro' ? <Badge variant="default">Pro</Badge> : <Badge variant="secondary">Free</Badge>}
          </div>
          <CardDescription>
            {tier === 'pro'
              ? 'Unlimited panel runs, all personas, custom personas, and full context injection.'
              : 'Limited to 5 panel runs per month. Upgrade for unlimited runs and Pro features.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {tier === 'free' ? (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="font-medium">{runsLeft} of {FREE_RUN_LIMIT} runs remaining this month</p>
              {resetDate && (
                <p className="mt-1 text-muted-foreground">Resets on {resetDate}</p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="font-medium">Unlimited panel runs</p>
              {renewalDate && (
                <p className="mt-1 text-muted-foreground">Renews on {renewalDate}</p>
              )}
            </div>
          )}

          {tier === 'pro' && hasStripeCustomer && <BillingPortalButton />}

          {tier === 'free' && (
            <Link href="/dashboard">
              <Button>Upgrade to Pro</Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
