import { describe, expect, it } from 'vitest'

import {
  INVITE_TTL_MS,
  createInviteMaterial,
  inviteUsability,
} from '@/lib/auth/invites'

describe('createInviteMaterial', () => {
  it('creates a 32-byte base64url token but persists only its SHA-256 hash', () => {
    const createdAt = new Date('2026-10-21T05:30:00.000Z')
    const invite = createInviteMaterial(createdAt)

    expect(invite.rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(invite.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(invite.tokenHash).not.toContain(invite.rawToken)
    expect(invite.persisted).not.toHaveProperty('rawToken')
    expect(invite.persisted.token_hash).toBe(invite.tokenHash)
  })

  it('expires exactly one hour after creation', () => {
    const createdAt = new Date('2026-10-21T05:30:00.000Z')
    const invite = createInviteMaterial(createdAt)

    expect(INVITE_TTL_MS).toBe(60 * 60 * 1000)
    expect(invite.persisted.expires_at.getTime() - createdAt.getTime()).toBe(INVITE_TTL_MS)
  })
})

describe('inviteUsability', () => {
  const now = new Date('2026-10-21T05:30:00.000Z')
  const base = {
    expires_at: new Date(now.getTime() + INVITE_TTL_MS),
    used_at: null as Date | null,
    revoked_at: null as Date | null,
  }

  it('accepts an unused, unrevoked, unexpired invite', () => {
    expect(inviteUsability(base, now)).toBe('usable')
  })

  it('rejects a revoked invite', () => {
    expect(inviteUsability({ ...base, revoked_at: now }, now)).toBe('revoked')
  })

  it('rejects an already-used invite', () => {
    expect(inviteUsability({ ...base, used_at: now }, now)).toBe('used')
  })

  it('rejects an expired invite including the exact expiry instant', () => {
    expect(inviteUsability({ ...base, expires_at: now }, now)).toBe('expired')
  })

  it('does not model or impose any account expiry from the invite TTL', () => {
    const invite = createInviteMaterial(now)
    expect(invite.persisted).not.toHaveProperty('account_expires_at')
    expect(invite.persisted).not.toHaveProperty('user_expires_at')
  })
})
