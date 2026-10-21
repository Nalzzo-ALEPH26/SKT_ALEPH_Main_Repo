import { describe, expect, it } from 'vitest'

import {
  requireActiveUser,
  requireAdmin,
  type AuthGuardClient,
} from '@/lib/auth/guards'

type FakeOptions = {
  sub?: string
  status?: 'active' | 'disabled' | 'expelled'
  appRole?: 'admin' | 'member'
  userRole?: 'admin' | 'member'
}

function fakeClient({
  sub = '11111111-1111-1111-1111-111111111111',
  status = 'active',
  appRole = 'member',
  userRole = 'member',
}: FakeOptions = {}): AuthGuardClient {
  const claims = sub
    ? {
        sub,
        app_metadata: { role: appRole },
        user_metadata: { role: userRole },
      }
    : null

  return {
    auth: {
      getClaims: async () => ({ data: { claims }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
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
        }),
      }),
    }),
  }
}

describe('requireActiveUser', () => {
  it('accepts a verified JWT only when the database profile is active', async () => {
    const result = await requireActiveUser(fakeClient())

    expect(result.profile.status).toBe('active')
    expect(result.claims.sub).toBe('11111111-1111-1111-1111-111111111111')
  })

  it.each(['disabled', 'expelled'] as const)(
    'rejects a %s profile even when the JWT is still valid',
    async (status) => {
      await expect(requireActiveUser(fakeClient({ status }))).rejects.toMatchObject({
        code: 'USER_INACTIVE',
      })
    },
  )

  it('rejects a request without verified claims', async () => {
    await expect(requireActiveUser(fakeClient({ sub: '' }))).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })
})

describe('requireAdmin', () => {
  it('accepts the admin role only from app_metadata', async () => {
    const result = await requireAdmin(fakeClient({ appRole: 'admin', userRole: 'member' }))
    expect(result.profile.status).toBe('active')
  })

  it('does not trust a user-editable user_metadata admin role', async () => {
    await expect(
      requireAdmin(fakeClient({ appRole: 'member', userRole: 'admin' })),
    ).rejects.toMatchObject({ code: 'ADMIN_REQUIRED' })
  })
})
