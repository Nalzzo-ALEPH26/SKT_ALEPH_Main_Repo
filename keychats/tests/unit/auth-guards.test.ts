import { describe, expect, it } from 'vitest'

import {
  requireActiveUser,
  requireAdmin,
  type AuthGuardAccess,
} from '@/lib/auth/guards'

type FakeOptions = {
  sub?: string
  status?: 'active' | 'disabled' | 'expelled'
  appRole?: 'admin' | 'member'
  userRole?: 'admin' | 'member'
}

function fakeAccess({
  sub = '11111111-1111-1111-1111-111111111111',
  status = 'active',
  appRole = 'member',
  userRole = 'member',
}: FakeOptions = {}): AuthGuardAccess {
  const claims = sub
    ? {
        sub,
        app_metadata: { role: appRole },
        user_metadata: { role: userRole },
      }
    : null

  return {
    getClaims: async () => ({ data: { claims }, error: null }),
    getProfile: async () => ({
      data: sub
        ? {
            user_id: sub,
            username: 'member1',
            display_name: 'Member One',
            avatar_path: null,
            status,
          }
        : null,
      error: null,
    }),
  }
}

describe('requireActiveUser', () => {
  it('accepts a verified JWT only when the database profile is active', async () => {
    const result = await requireActiveUser(fakeAccess())

    expect(result.profile.status).toBe('active')
    expect(result.claims.sub).toBe('11111111-1111-1111-1111-111111111111')
  })

  it.each(['disabled', 'expelled'] as const)(
    'rejects a %s profile even when the JWT is still valid',
    async (status) => {
      await expect(requireActiveUser(fakeAccess({ status }))).rejects.toMatchObject({
        code: 'USER_INACTIVE',
      })
    },
  )

  it('rejects a request without verified claims', async () => {
    await expect(requireActiveUser(fakeAccess({ sub: '' }))).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })
})

describe('requireAdmin', () => {
  it('accepts the admin role only from app_metadata', async () => {
    const result = await requireAdmin(fakeAccess({ appRole: 'admin', userRole: 'member' }))
    expect(result.profile.status).toBe('active')
  })

  it('does not trust a user-editable user_metadata admin role', async () => {
    await expect(
      requireAdmin(fakeAccess({ appRole: 'member', userRole: 'admin' })),
    ).rejects.toMatchObject({ code: 'ADMIN_REQUIRED' })
  })
})
