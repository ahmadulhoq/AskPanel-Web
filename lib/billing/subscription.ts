// The subset of a Stripe Subscription we read. In this API version the billing period
// lives on the subscription items, not the subscription.
export interface StripeSubscriptionLike {
  id: string
  customer: string | { id: string }
  status: 'active' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'paused' | 'trialing' | 'unpaid'
  cancel_at_period_end: boolean
  items: { data: { current_period_end: number }[] }
}

export interface SubscriptionFields {
  tier: 'free' | 'pro'
  status: StripeSubscriptionLike['status']
  subscriptionId: string
  customerId: string
  currentPeriodEndMs: number | null
  cancelAtPeriodEnd: boolean
}

// past_due keeps access while Stripe retries the payment; once retries are exhausted,
// Stripe moves the subscription to canceled or unpaid (per the account's billing settings).
const PRO_STATUSES = new Set<SubscriptionFields['status']>(['active', 'trialing', 'past_due'])

export function subscriptionFields(sub: StripeSubscriptionLike): SubscriptionFields {
  const periodEnd = sub.items.data[0]?.current_period_end
  return {
    tier: PRO_STATUSES.has(sub.status) ? 'pro' : 'free',
    status: sub.status,
    subscriptionId: sub.id,
    customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    currentPeriodEndMs: periodEnd ? periodEnd * 1000 : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  }
}

// Stripe doesn't guarantee event order: a late event about a user's previous subscription
// must not override the one they have now. A new paying subscription always wins.
export function shouldApply(currentSubscriptionId: string | null, incoming: SubscriptionFields): boolean {
  if (!currentSubscriptionId || currentSubscriptionId === incoming.subscriptionId) return true
  return incoming.tier === 'pro'
}

// Free and Pro share one debate counter. When Pro ends, the free allowance starts fresh:
// debates run under Pro's 100 shouldn't use up the 5 free ones. (Upgrading keeps the count.)
export function allowanceOnTierChange(from: 'free' | 'pro' | undefined, to: 'free' | 'pro'): Record<string, unknown> {
  return from === 'pro' && to === 'free' ? { freeRunsUsed: 0, freeRunsResetAt: null } : {}
}
