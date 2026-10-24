import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => {
  const repository = {
    getOrCreate: vi.fn(),
    hide: vi.fn(),
    unhide: vi.fn(),
  }

  return {
    repository,
    createClient: vi.fn(async () => ({ auth: {}, from: vi.fn() })),
    createAuthGuardAccess: vi.fn(() => ({ guard: true })),
    requireActiveUser: vi.fn(),
    createSupabaseDmRepository: vi.fn(() => repository),
    revalidatePath: vi.fn(),
    redirect: vi.fn(),
  }
})

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/auth/server-access', () => ({ createAuthGuardAccess: mocks.createAuthGuardAccess }))
vi.mock('@/lib/auth/guards', () => ({ requireActiveUser: mocks.requireActiveUser }))
vi.mock('@/lib/dms/supabase', () => ({ createSupabaseDmRepository: mocks.createSupabaseDmRepository }))

import {
  manageDirectMessagesAction,
  startDirectMessageAction,
} from '@/app/(workspace)/dm/dm-actions'

const currentUserId = '33333333-3333-3333-3333-333333333333'
const otherUserId = '11111111-1111-1111-1111-111111111111'
const threadId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireActiveUser.mockResolvedValue({
    claims: { sub: currentUserId, app_metadata: { role: 'member' } },
    profile: { user_id: currentUserId, status: 'active' },
  })
  mocks.repository.getOrCreate.mockResolvedValue({
    id: threadId,
    userLow: otherUserId,
    userHigh: currentUserId,
  })
})

describe('startDirectMessageAction', () => {
  it('restores the thread, invalidates workspace layout and redirects', async () => {
    const formData = new FormData()
    formData.set('otherUserId', otherUserId)

    await startDirectMessageAction(formData)

    expect(mocks.requireActiveUser).toHaveBeenCalledOnce()
    expect(mocks.repository.getOrCreate).toHaveBeenCalledWith({
      userLow: otherUserId,
      userHigh: currentUserId,
    })
    expect(mocks.repository.unhide).toHaveBeenCalledWith(threadId, currentUserId)
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(mocks.redirect).toHaveBeenCalledWith(`/dm/${threadId}`)
  })

  it('rejects a missing target before touching the repository', async () => {
    await expect(startDirectMessageAction(new FormData())).rejects.toThrow('OTHER_USER_ID_REQUIRED')
    expect(mocks.repository.getOrCreate).not.toHaveBeenCalled()
  })
})

describe('manageDirectMessagesAction', () => {
  it('does nothing when no DM room is selected instead of throwing a server error', async () => {
    await expect(manageDirectMessagesAction(new FormData())).resolves.toBeUndefined()

    expect(mocks.requireActiveUser).not.toHaveBeenCalled()
    expect(mocks.repository.hide).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
})
