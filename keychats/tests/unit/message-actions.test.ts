import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => {
  const repo = {
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    listChannel: vi.fn(),
  }

  return {
    repo,
    createClient: vi.fn(async () => ({ auth: {}, from: vi.fn() })),
    createAuthGuardAccess: vi.fn(() => ({ guard: true })),
    requireActiveUser: vi.fn(),
    createSupabaseMessageRepository: vi.fn(() => repo),
  }
})

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/auth/server-access', () => ({ createAuthGuardAccess: mocks.createAuthGuardAccess }))
vi.mock('@/lib/auth/guards', () => ({ requireActiveUser: mocks.requireActiveUser }))
vi.mock('@/lib/messages/supabase', () => ({
  createSupabaseMessageRepository: mocks.createSupabaseMessageRepository,
}))

import {
  deleteChannelMessageAction,
  editChannelMessageAction,
  loadOlderChannelMessagesAction,
  sendChannelMessageAction,
} from '@/app/(workspace)/channel/message-actions'

const channelId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const userId = '11111111-1111-1111-1111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireActiveUser.mockResolvedValue({
    claims: { sub: userId, app_metadata: { role: 'admin' } },
    profile: { user_id: userId, status: 'active' },
  })
  mocks.repo.getById.mockResolvedValue(null)
  mocks.repo.create.mockResolvedValue({
    id: 1,
    channelId,
    dmThreadId: null,
    senderId: userId,
    body: 'hello',
    replyToId: null,
    createdAt: '2026-10-21T00:00:00.000Z',
    editedAt: null,
    deletedAt: null,
  })
  mocks.repo.update.mockImplementation(async (_id, patch) => ({
    id: 1,
    channelId,
    dmThreadId: null,
    senderId: userId,
    body: patch.body ?? 'hello',
    replyToId: null,
    createdAt: '2026-10-21T00:00:00.000Z',
    editedAt: patch.editedAt ?? null,
    deletedAt: patch.deletedAt ?? null,
  }))
  mocks.repo.listChannel.mockResolvedValue([])
})

describe('channel message server actions', () => {
  it('derives sender/admin identity from verified auth state when sending', async () => {
    await sendChannelMessageAction({ channelId, body: ' hello ', replyToId: null })

    expect(mocks.requireActiveUser).toHaveBeenCalledOnce()
    expect(mocks.repo.create).toHaveBeenCalledWith({
      channelId,
      dmThreadId: null,
      senderId: userId,
      body: 'hello',
      replyToId: null,
    })
  })

  it('uses the authenticated actor for edit and delete authorization', async () => {
    mocks.repo.getById.mockResolvedValue({
      id: 1,
      channelId,
      dmThreadId: null,
      senderId: userId,
      body: 'hello',
      replyToId: null,
      createdAt: '2026-10-21T00:00:00.000Z',
      editedAt: null,
      deletedAt: null,
    })

    await editChannelMessageAction({ channelId, messageId: 1, body: 'changed' })
    await deleteChannelMessageAction({ channelId, messageId: 1 })

    expect(mocks.repo.update).toHaveBeenCalledTimes(2)
  })

  it('loads older history only through the authenticated repository', async () => {
    await loadOlderChannelMessagesAction({ channelId, beforeId: 120 })

    expect(mocks.repo.listChannel).toHaveBeenCalledWith({ channelId, beforeId: 120, limit: 50 })
  })
})
