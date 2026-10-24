import { describe, expect, it, vi } from 'vitest'

import {
  deleteManagedUser,
  disableManagedUser,
  expelManagedUser,
  generateTemporaryPassword,
  resetManagedUserPassword,
  type AdminRepository,
} from '@/lib/admin/service'

const adminId = '11111111-1111-1111-1111-111111111111'
const memberId = '22222222-2222-2222-2222-222222222222'

function repository(username = 'member') {
  const repo: AdminRepository = {
    listUsers: vi.fn(async () => []),
    getUser: vi.fn(async (userId) => ({ userId, username, displayName: username, status: 'active' as const, createdAt: '2026-10-21T00:00:00.000Z' })),
    setStatus: vi.fn(async () => undefined),
    updatePassword: vi.fn(async () => undefined),
    banUser: vi.fn(async () => undefined),
    deleteUser: vi.fn(async () => undefined),
    markDeleted: vi.fn(async () => undefined),
  }
  return repo
}

describe('admin account controls', () => {
  it('generates a high-entropy temporary password with required character classes', () => {
    const password = generateTemporaryPassword(() => Buffer.alloc(18, 7))
    expect(password.length).toBeGreaterThanOrEqual(24)
    expect(password).toMatch(/[A-Z]/)
    expect(password).toMatch(/[a-z]/)
    expect(password).toMatch(/\d/)
    expect(password).toMatch(/[^A-Za-z0-9]/)
  })

  it('updates the Auth password without storing it in profile state', async () => {
    const repo = repository()
    const password = await resetManagedUserPassword(repo, memberId, () => Buffer.alloc(18, 9))
    expect(repo.updatePassword).toHaveBeenCalledWith(memberId, password)
    expect(repo.setStatus).not.toHaveBeenCalled()
  })

  it('blocks temporary password reset for the sole cxu1344 admin', async () => {
    const repo = repository('cxu1344')
    await expect(resetManagedUserPassword(repo, adminId, () => Buffer.alloc(18, 9))).rejects.toThrow('SOLE_ADMIN_PROTECTED')
    expect(repo.updatePassword).not.toHaveBeenCalled()
  })

  it('disables database access before banning future Auth sessions', async () => {
    const repo = repository()
    await disableManagedUser(repo, memberId)
    expect(repo.setStatus).toHaveBeenCalledWith(memberId, 'disabled')
    expect(repo.banUser).toHaveBeenCalledWith(memberId)
    expect(vi.mocked(repo.setStatus).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(repo.banUser).mock.invocationCallOrder[0])
  })

  it('marks expelled users without deleting their historical profile/messages', async () => {
    const repo = repository()
    await expelManagedUser(repo, memberId)
    expect(repo.setStatus).toHaveBeenCalledWith(memberId, 'expelled')
    expect(repo.banUser).toHaveBeenCalledWith(memberId)
  })

  it('soft-deletes login before hiding the retained historical profile', async () => {
    const repo = repository()
    await deleteManagedUser(repo, memberId)
    expect(repo.setStatus).toHaveBeenCalledWith(memberId, 'expelled')
    expect(repo.deleteUser).toHaveBeenCalledWith(memberId)
    expect(repo.markDeleted).toHaveBeenCalledWith(memberId)
    expect(vi.mocked(repo.deleteUser).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(repo.markDeleted).mock.invocationCallOrder[0])
  })

  it.each([
    ['disable', (repo: AdminRepository) => disableManagedUser(repo, adminId)],
    ['expel', (repo: AdminRepository) => expelManagedUser(repo, adminId)],
    ['delete', (repo: AdminRepository) => deleteManagedUser(repo, adminId)],
  ])('protects the sole cxu1344 admin from %s', async (_name, invoke) => {
    const repo = repository('cxu1344')
    await expect(invoke(repo)).rejects.toThrow('SOLE_ADMIN_PROTECTED')
    expect(repo.setStatus).not.toHaveBeenCalled()
    expect(repo.banUser).not.toHaveBeenCalled()
    expect(repo.deleteUser).not.toHaveBeenCalled()
    expect(repo.markDeleted).not.toHaveBeenCalled()
  })
})
