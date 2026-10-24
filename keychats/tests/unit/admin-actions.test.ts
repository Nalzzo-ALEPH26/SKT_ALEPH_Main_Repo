import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  userClient: { auth: {} },
  adminClient: { auth: { admin: {} }, from: vi.fn() },
  repository: { adminRepository: true },
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  createAuthGuardAccess: vi.fn(() => ({ guard: true })),
  requireAdmin: vi.fn(),
  createSupabaseAdminRepository: vi.fn(),
  listManagedUsers: vi.fn(),
  resetManagedUserPassword: vi.fn(),
  disableManagedUser: vi.fn(),
  expelManagedUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/auth/server-access', () => ({ createAuthGuardAccess: mocks.createAuthGuardAccess }))
vi.mock('@/lib/auth/guards', () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock('@/lib/admin/supabase', () => ({
  createSupabaseAdminRepository: mocks.createSupabaseAdminRepository,
}))
vi.mock('@/lib/admin/service', () => ({
  listManagedUsers: mocks.listManagedUsers,
  resetManagedUserPassword: mocks.resetManagedUserPassword,
  disableManagedUser: mocks.disableManagedUser,
  expelManagedUser: mocks.expelManagedUser,
}))

import {
  disableUserAction,
  expelUserAction,
  listUsersAction,
  resetUserPasswordAction,
} from '@/app/(workspace)/admin/admin-actions'

const targetId = '22222222-2222-2222-2222-222222222222'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createClient.mockResolvedValue(mocks.userClient)
  mocks.createAdminClient.mockReturnValue(mocks.adminClient)
  mocks.createSupabaseAdminRepository.mockReturnValue(mocks.repository)
  mocks.requireAdmin.mockResolvedValue({
    claims: { sub: '11111111-1111-1111-1111-111111111111', app_metadata: { role: 'admin' } },
    profile: { user_id: '11111111-1111-1111-1111-111111111111', status: 'active' },
  })
  mocks.listManagedUsers.mockResolvedValue([])
  mocks.resetManagedUserPassword.mockResolvedValue('Kc!temporary-password9a')
  mocks.disableManagedUser.mockResolvedValue(undefined)
  mocks.expelManagedUser.mockResolvedValue(undefined)
})

describe('admin server actions', () => {
  it.each([
    () => listUsersAction(),
    () => resetUserPasswordAction(targetId),
    () => disableUserAction(targetId),
    () => expelUserAction(targetId),
  ])('rejects direct invocation when requireAdmin rejects', async (invoke) => {
    mocks.requireAdmin.mockRejectedValueOnce(new Error('AUTH_ADMIN_REQUIRED'))

    await expect(invoke()).rejects.toThrow('AUTH_ADMIN_REQUIRED')
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it('lists users only through the privileged repository after admin verification', async () => {
    mocks.listManagedUsers.mockResolvedValue([{ userId: targetId, username: 'member', status: 'active' }])

    await expect(listUsersAction()).resolves.toEqual([
      { userId: targetId, username: 'member', status: 'active' },
    ])
    expect(mocks.listManagedUsers).toHaveBeenCalledWith(mocks.repository)
  })

  it('returns a temporary password only from the reset operation', async () => {
    await expect(resetUserPasswordAction(targetId)).resolves.toEqual({
      temporaryPassword: 'Kc!temporary-password9a',
    })
    expect(mocks.resetManagedUserPassword).toHaveBeenCalledWith(mocks.repository, targetId)
  })

  it('delegates disable and expel with the verified privileged repository', async () => {
    await expect(disableUserAction(targetId)).resolves.toEqual({ status: 'disabled' })
    await expect(expelUserAction(targetId)).resolves.toEqual({ status: 'expelled' })
    expect(mocks.disableManagedUser).toHaveBeenCalledWith(mocks.repository, targetId)
    expect(mocks.expelManagedUser).toHaveBeenCalledWith(mocks.repository, targetId)
  })
})
