import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { hashToken, newToken, tokenHint } from './tokenFormat'

export const MAX_TOKENS = 5
// lastUsedAt is refreshed at most this often (not a write per request).
const TOUCH_MS = 10 * 60 * 1000

export class TokenLimitError extends Error {}

export interface ApiTokenView {
  id: string
  name: string
  hint: string
  createdAt: number
  lastUsedAt: number | null
}

const tokens = () => adminDb().collection('apiTokens')

// Creates a token and returns it — the only time it exists in clear text.
export async function createApiToken(uid: string, rawName: unknown): Promise<{ token: string; view: ApiTokenView }> {
  const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim().slice(0, 40) : 'API token'
  const token = newToken()
  const id = hashToken(token)
  const now = Date.now()
  // In a transaction, so parallel requests can't get past the cap.
  await adminDb().runTransaction(async (tx) => {
    const existing = await tx.get(tokens().where('uid', '==', uid))
    if (existing.size >= MAX_TOKENS) throw new TokenLimitError(`You can have up to ${MAX_TOKENS} tokens. Revoke one first.`)
    tx.set(tokens().doc(id), { uid, name, hint: tokenHint(token), createdAt: Timestamp.fromMillis(now), lastUsedAt: null })
  })
  return { token, view: { id, name, hint: tokenHint(token), createdAt: now, lastUsedAt: null } }
}

export async function listApiTokens(uid: string): Promise<ApiTokenView[]> {
  const snap = await tokens().where('uid', '==', uid).get()
  return snap.docs
    .map((d) => {
      const t = d.data()
      return { id: d.id, name: t.name, hint: t.hint, createdAt: t.createdAt?.toMillis() ?? 0, lastUsedAt: t.lastUsedAt?.toMillis() ?? null }
    })
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function revokeApiToken(uid: string, id: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(id)) return false
  const ref = tokens().doc(id)
  const snap = await ref.get()
  if (!snap.exists || snap.data()?.uid !== uid) return false
  await ref.delete()
  return true
}

// Whether the sign-in account still allows access: not deleted, not disabled, and its
// sessions not revoked since the token was made (revoking sessions revokes tokens too).
// Cached briefly per instance, so it isn't an Auth call on every MCP request.
const ACCOUNT_CHECK_MS = 60_000
const accountChecks = new Map<string, { at: number; disabled: boolean; validAfter: number }>()
async function accountAllows(uid: string, tokenCreatedAt: number): Promise<boolean> {
  let check = accountChecks.get(uid)
  if (!check || Date.now() - check.at > ACCOUNT_CHECK_MS) {
    try {
      const user = await adminAuth().getUser(uid)
      check = { at: Date.now(), disabled: user.disabled, validAfter: user.tokensValidAfterTime ? Date.parse(user.tokensValidAfterTime) : 0 }
    } catch {
      check = { at: Date.now(), disabled: true, validAfter: 0 } // deleted (or unknown): no access
    }
    accountChecks.set(uid, check)
  }
  return !check.disabled && tokenCreatedAt >= check.validAfter
}

// The user a token belongs to, or null.
export async function verifyApiToken(token: string): Promise<string | null> {
  const ref = tokens().doc(hashToken(token))
  const snap = await ref.get()
  if (!snap.exists) return null
  const data = snap.data()!
  if (!(await accountAllows(data.uid, data.createdAt?.toMillis() ?? 0))) return null
  const last = data.lastUsedAt?.toMillis() ?? 0
  if (Date.now() - last > TOUCH_MS) ref.update({ lastUsedAt: FieldValue.serverTimestamp() }).catch(() => {})
  return data.uid as string
}
