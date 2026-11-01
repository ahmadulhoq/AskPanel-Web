import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
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
  const existing = await tokens().where('uid', '==', uid).count().get()
  if (existing.data().count >= MAX_TOKENS) throw new TokenLimitError(`You can have up to ${MAX_TOKENS} tokens. Revoke one first.`)
  const token = newToken()
  const id = hashToken(token)
  const now = Date.now()
  await tokens().doc(id).set({ uid, name, hint: tokenHint(token), createdAt: Timestamp.fromMillis(now), lastUsedAt: null })
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

// The user a token belongs to, or null.
export async function verifyApiToken(token: string): Promise<string | null> {
  const ref = tokens().doc(hashToken(token))
  const snap = await ref.get()
  if (!snap.exists) return null
  const data = snap.data()!
  const last = data.lastUsedAt?.toMillis() ?? 0
  if (Date.now() - last > TOUCH_MS) ref.update({ lastUsedAt: FieldValue.serverTimestamp() }).catch(() => {})
  return data.uid as string
}
