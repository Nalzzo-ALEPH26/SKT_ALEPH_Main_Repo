import { describe, expect, it, vi } from 'vitest'

import {
  INVITE_TTL_MS,
  completeInviteRegistration,
  createInviteMaterial,
  inviteUsability,
  validateInviteRegistrationInput,
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

describe('validateInviteRegistrationInput', () => {
  it('normalizes the login ID and display name', () => {
    expect(
      validateInviteRegistrationInput({
        loginId: '  CXU_TEST  ',
        displayName: '  Miles  ',
        password: 'password123',
      }),
    ).toEqual({ loginId: 'cxu_test', displayName: 'Miles', password: 'password123' })
  })

  it('rejects short passwords and blank display names', () => {
    expect(() =>
      validateInviteRegistrationInput({ loginId: 'member1', displayName: ' ', password: '1234567' }),
    ).toThrow()
  })
})

describe('completeInviteRegistration', () => {
  const now = new Date('2026-10-21T05:30:00.000Z')
  const input = { loginId: 'member1', displayName: 'Member One', password: 'password123' }
  const handle = { tokenHash: 'a'.repeat(64), claimId: 'aaaaaaaa-1111-1111-1111-111111111111' }

  function dependencies() {
    return {
      claimInvite: vi.fn().mockResolvedValue(handle),
      createAuthUser: vi.fn().mockResolvedValue({ id: '77777777-7777-7777-7777-777777777777' }),
      provisionWorkspaceUser: vi.fn().mockResolvedValue(undefined),
      finalizeInvite: vi.fn().mockResolvedValue(true),
      deleteAuthUser: vi.fn().mockResolvedValue(undefined),
      releaseInviteClaim: vi.fn().mockResolvedValue(undefined),
    }
  }

  it('stops before creating an account when the invite cannot be claimed', async () => {
    const deps = dependencies()
    deps.claimInvite.mockResolvedValue(null)

    await expect(completeInviteRegistration(deps, 'raw-token', input, now)).rejects.toThrow('INVITE_UNAVAILABLE')
    expect(deps.createAuthUser).not.toHaveBeenCalled()
  })

  it('deletes a partial Auth user and releases the claim when workspace provisioning fails', async () => {
    const deps = dependencies()
    deps.provisionWorkspaceUser.mockRejectedValue(new Error('GENERAL_CHANNEL_MISSING'))

    await expect(completeInviteRegistration(deps, 'raw-token', input, now)).rejects.toThrow('GENERAL_CHANNEL_MISSING')
    expect(deps.deleteAuthUser).toHaveBeenCalledWith('77777777-7777-7777-7777-777777777777')
    expect(deps.releaseInviteClaim).toHaveBeenCalledWith(handle)
    expect(deps.finalizeInvite).not.toHaveBeenCalled()
  })

  it('finalizes once and does not run cleanup after successful registration', async () => {
    const deps = dependencies()

    await expect(completeInviteRegistration(deps, 'raw-token', input, now)).resolves.toEqual({
      userId: '77777777-7777-7777-7777-777777777777',
      loginId: 'member1',
    })
    expect(deps.createAuthUser).toHaveBeenCalledWith({
      email: 'member1@auth.keychats.invalid',
      password: 'password123',
    })
    expect(deps.provisionWorkspaceUser).toHaveBeenCalledWith({
      userId: '77777777-7777-7777-7777-777777777777',
      username: 'member1',
      displayName: 'Member One',
    })
    expect(deps.finalizeInvite).toHaveBeenCalledWith(handle, '77777777-7777-7777-7777-777777777777', now)
    expect(deps.deleteAuthUser).not.toHaveBeenCalled()
    expect(deps.releaseInviteClaim).not.toHaveBeenCalled()
  })
})
