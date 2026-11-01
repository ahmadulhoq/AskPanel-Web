import { test } from 'node:test'
import assert from 'node:assert/strict'
import { subscriptionFields, shouldApply, allowanceOnTierChange, type StripeSubscriptionLike } from './subscription.ts'

const sub = (over: Partial<StripeSubscriptionLike> = {}): StripeSubscriptionLike => ({
  id: 'sub_1',
  customer: 'cus_1',
  status: 'active',
  cancel_at_period_end: false,
  items: { data: [{ current_period_end: 1_900_000_000 }] },
  ...over,
})

test('active and trialing subscriptions grant Pro with the renewal date', () => {
  for (const status of ['active', 'trialing'] as const) {
    const f = subscriptionFields(sub({ status }))
    assert.equal(f.tier, 'pro')
    assert.equal(f.currentPeriodEndMs, 1_900_000_000_000)
    assert.equal(f.subscriptionId, 'sub_1')
    assert.equal(f.customerId, 'cus_1')
  }
})

test('past_due keeps Pro while Stripe retries the payment', () => {
  assert.equal(subscriptionFields(sub({ status: 'past_due' })).tier, 'pro')
})

test('ended, unpaid or never-paid subscriptions drop to free', () => {
  for (const status of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'] as const) {
    assert.equal(subscriptionFields(sub({ status })).tier, 'free', status)
  }
})

test('a scheduled cancellation is reported but keeps Pro until the period ends', () => {
  const f = subscriptionFields(sub({ cancel_at_period_end: true }))
  assert.equal(f.tier, 'pro')
  assert.equal(f.cancelAtPeriodEnd, true)
})

test('an expanded customer object yields its id', () => {
  assert.equal(subscriptionFields(sub({ customer: { id: 'cus_9' } })).customerId, 'cus_9')
})

test('events for an old subscription cannot downgrade a newer one', () => {
  const oldCanceled = subscriptionFields(sub({ id: 'sub_old', status: 'canceled' }))
  assert.equal(shouldApply('sub_new', oldCanceled), false)
  assert.equal(shouldApply('sub_old', oldCanceled), true, 'same subscription applies')
  assert.equal(shouldApply(null, oldCanceled), true, 'no subscription on record applies')
  const newActive = subscriptionFields(sub({ id: 'sub_new2', status: 'active' }))
  assert.equal(shouldApply('sub_old', newActive), true, 'a new paying subscription replaces the old one')
})

test('allowanceOnTierChange: the free allowance starts fresh only when Pro ends', () => {
  assert.deepEqual(allowanceOnTierChange('pro', 'free'), { freeRunsUsed: 0, freeRunsResetAt: null })
  assert.deepEqual(allowanceOnTierChange('free', 'pro'), {})
  assert.deepEqual(allowanceOnTierChange('pro', 'pro'), {}, 'a duplicate or renewal event changes nothing')
  assert.deepEqual(allowanceOnTierChange('free', 'free'), {})
  assert.deepEqual(allowanceOnTierChange(undefined, 'free'), {})
})
