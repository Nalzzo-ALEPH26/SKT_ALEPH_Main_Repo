import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => ({
  client: { auth: {}, from: vi.fn() },
  repository: { state: true },
  createClient: vi.fn(),
  createAuthGuardAccess: vi.fn(() => ({ guard: true })),
  requireActiveUser: vi.fn(),
  createSupabaseMessageStateRepository: vi.fn(),
  loadMessageStateSnapshot: vi.fn(),
  toggleReaction: vi.fn(),
  togglePin: vi.fn(),
  markRoomRead: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/auth/server-access', () => ({ createAuthGuardAccess: mocks.createAuthGuardAccess }))
vi.mock('@/lib/auth/guards', () => ({ requireActiveUser: mocks.requireActiveUser }))
vi.mock('@/lib/messages/state-supabase', () => ({
  createSupabaseMessageStateRepository: mocks.createSupabaseMessageStateRepository,
  loadMessageStateSnapshot: mocks.loadMessageStateSnapshot,
}))
vi.mock('@/lib/messages/service', () => ({
  toggleReaction: mocks.toggleReaction,
  togglePin: mocks.togglePin,
  markRoomRead: mocks.markRoomRead,
}))

import {
  loadMessageStateAction,
  markConversationReadAction,
  toggleMessagePinAction,
  toggleMessageReactionAction,
} from '@/app/(workspace)/message-state-actions'

const userId = '11111111-1111-1111-1111-111111111111'
const actor = { userId, isAdmin: false }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createClient.mockResolvedValue(mocks.client)
  mocks.requireActiveUser.mockResolvedValue({
    claims: { sub: userId, app_metadata: { role: 'member' } },
    profile: { user_id: userId, status: 'active' },
  })
  mocks.createSupabaseMessageStateRepository.mockReturnValue(mocks.repository)
  mocks.toggleReaction.mockResolvedValue(true)
  mocks.togglePin.mockResolvedValue(false)
  mocks.markRoomRead.mockResolvedValue(undefined)
  mocks.loadMessageStateSnapshot.mockResolvedValue({})
})

describe('message state server actions', () => {
  it('derives the reaction actor from verified auth state', async () => {
    await expect(
      toggleMessageReactionAction({ messageId: 7, emoji: '👍' }),
    ).resolves.toEqual({ active: true })

    expect(mocks.toggleReaction).toHaveBeenCalledWith(mocks.repository, actor, 7, '👍')
  })

  it('derives the pin actor from verified auth state', async () => {
    await expect(toggleMessagePinAction({ messageId: 8 })).resolves.toEqual({ pinned: false })

    expect(mocks.togglePin).toHaveBeenCalledWith(mocks.repository, actor, 8)
  })

  it('marks exactly the requested conversation target read for the authenticated user', async () => {
    await markConversationReadAction({
      channelId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      dmThreadId: null,
      lastReadMessageId: 42,
    })

    expect(mocks.markRoomRead).toHaveBeenCalledWith(
      mocks.repository,
      actor,
      { channelId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', dmThreadId: null },
      42,
    )
  })

  it('reloads message state through the authenticated Supabase client', async () => {
    mocks.loadMessageStateSnapshot.mockResolvedValue({
      7: { isPinned: false, reactions: [] },
    })

    await expect(loadMessageStateAction({ messageIds: [7] })).resolves.toEqual({
      7: { isPinned: false, reactions: [] },
    })

    expect(mocks.loadMessageStateSnapshot).toHaveBeenCalledWith(mocks.client, [7], userId)
  })
})
