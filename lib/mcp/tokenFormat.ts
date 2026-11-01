import { createHash, randomBytes } from 'node:crypto'

// Personal API tokens: "ap_" + 32 random base64url chars. Only a SHA-256 hash is stored;
// the token itself is shown to the user once. Pure (tested).
const PREFIX = 'ap_'
const TOKEN_PATTERN = /^ap_[A-Za-z0-9_-]{32}$/

export const newToken = () => PREFIX + randomBytes(24).toString('base64url')
export const isTokenShaped = (token: string) => TOKEN_PATTERN.test(token)
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
// What the account page shows to tell tokens apart.
export const tokenHint = (token: string) => `${token.slice(0, 7)}…`

// The token from an "Authorization: Bearer ap_…" header, if well-formed.
export function bearerToken(header: string | null): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header?.trim() ?? '')
  return match && isTokenShaped(match[1]) ? match[1] : null
}
