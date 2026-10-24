import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => {
  const repository = {
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    listChannel: vi.fn(),
    listDm: vi.fn(),
  }

  return {
    repository,
    createClient: vi.fn(async () => ({ auth: {}, from: vi.fn() })),
    createAuthGuardAccess: vi.fn(() => ({ guard: true })),
    requireActiveUser: vi.fn(),
    createSupabaseMessageRepository: vi.fn(() => repository),
  }
})

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/auth/server-access', () => ({ createAuthGuardAccess: mocks.createAuthGuardAccess }))
vi.mock('@/lib/auth/guards', () => ({ requireActiveUser: mocks.requireActiveUser }))
vi.mock('@/lib/messages/supabase', () => ({
  createSupabaseMessageRepository: mocks.createSupabaseMessageRepository,
}))

import {
  deleteDmMessageAction,
  editDmMessageAction,
  loadOlderDmMessagesAction,
  sendDmMessageAction,
} from '@/app/(workspace)/dm/message-actions'

const currentUserId = '11111111-1111-1111-1111-111111111111'
const dmThreadId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const otherThreadId = 'dddddddd-dddd-dddd-dddd-dddddddddddd'

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 41,
    channelId: null,
    dmThreadId,
    senderId: currentUserId,
    body: 'hello',
    replyToId: null,
    createdAt: '2026-10-21T00:00:00.000Z',
    editedAt: null,
    deletedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireActiveUser.mockResolvedValue({
    claims: { sub: currentUserId, app_metadata: { role: 'member' } },
    profile: { user_id: currentUserId, status: 'active' },
  })
  mocks.repository.getById.mockResolvedValue(row())
  mocks.repository.create.mockResolvedValue(row())
  mocks.repository.update.mockResolvedValue(row())
  mocks.repository.listDm.mockResolvedValue([row()])
})

describe('DM message actions', () => {
  it('sends with authenticated identity through the DM-scoped repository', async () => {
    await sendDmMessageAction({ dmThreadId, body: ' private ', replyToId: null })

    expect(mocks.repository.create).toHaveBeenCalledWith({
      channelId: null,
      dmThreadId,
      senderId: currentUserId,
      body: 'private',
      replyToId: null,
    })
  })

  it('rejects editing a message from another DM thread', async () => {
    mocks.repository.getById.mockResolvedValue(row({ dmThreadId: otherThreadId }))

    await expect(
      editDmMessageAction({ dmThreadId, messageId: 41, body: 'changed' }),
    ).rejects.toThrow('MESSAGE_ROOM_MISMATCH')
    expect(mocks.repository.update).not.toHaveBeenCalled()
  })

  it('rejects deleting a message from another DM thread', async () => {
    mocks.repository.getById.mockResolvedValue(row({ dmThreadId: otherThreadId }))

    await expect(deleteDmMessageAction({ dmThreadId, messageId: 41 })).rejects.toThrow(
      'MESSAGE_ROOM_MISMATCH',
    )
    expect(mocks.repository.update).not.toHaveBeenCalled()
  })

  it('loads older messages only from the requested DM thread', async () => {
    await loadOlderDmMessagesAction({ dmThreadId, beforeId: 41 })

    expect(mocks.repository.listDm).toHaveBeenCalledWith({
      dmThreadId,
      beforeId: 41,
      limit: 50,
    })
  })
})
