const LOGIN_ID_PATTERN = /^[a-z0-9_]{3,24}$/
const INTERNAL_AUTH_DOMAIN = 'auth.keychats.invalid'

export function normalizeLoginId(raw: string): string {
  const normalized = raw.trim().toLowerCase()

  if (!LOGIN_ID_PATTERN.test(normalized)) {
    throw new Error('LOGIN_ID_INVALID')
  }

  return normalized
}

export function loginIdToInternalEmail(loginId: string): string {
  return `${normalizeLoginId(loginId)}@${INTERNAL_AUTH_DOMAIN}`
}
