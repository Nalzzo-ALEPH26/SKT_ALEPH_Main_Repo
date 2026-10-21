import { createHash, randomBytes } from 'node:crypto'

export const INVITE_TTL_MS = 60 * 60 * 1000

export type InviteUsability = 'usable' | 'revoked' | 'used' | 'expired'

type InviteLifecycle = {
  expires_at: Date
  used_at: Date | null
  revoked_at: Date | null
}

export function hashInviteToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

export function createInviteMaterial(createdAt = new Date()) {
  const rawToken = randomBytes(32).toString('base64url')
  const tokenHash = hashInviteToken(rawToken)
  const expiresAt = new Date(createdAt.getTime() + INVITE_TTL_MS)

  return {
    rawToken,
    tokenHash,
    persisted: {
      token_hash: tokenHash,
      created_at: createdAt,
      expires_at: expiresAt,
    },
  }
}

export function inviteUsability(invite: InviteLifecycle, now = new Date()): InviteUsability {
  if (invite.revoked_at) return 'revoked'
  if (invite.used_at) return 'used'
  if (invite.expires_at.getTime() <= now.getTime()) return 'expired'
  return 'usable'
}
