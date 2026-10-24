import { describe, expect, it } from 'vitest'

import {
  getUnreadCounts,
  markRoomRead,
  togglePin,
  toggleReaction,
  type MessageActor,
  type MessageStateRepository,
} from '@/lib/messages/service'

const actor: MessageActor = {
  userId: '11111111-1111-1111-1111-111111111111',
  isAdmin: false,
}

function fakeStateRepository(): MessageStateRepository & {
  reactions: Set<string>
  pins: Map<number, string>
  reads: Array<{
    userId: string
    channelId: string | null
    dmThreadId: string | null
    lastReadMessageId: number | null
  }>
} {
  const reactions = new Set<string>()
  const pins = new Map<number, string>()
  const reads: Array<{
    userId: string
    channelId: string | null
    dmThreadId: string | null
    lastReadMessageId: number | null
  }> = []

  const reactionKey = (messageId: number, userId: string, emoji: string) =>
    `${messageId}:${userId}:${emoji}`

  return {
    reactions,
    pins,
    reads,
    async hasReaction(messageId, userId, emoji) {
      return reactions.has(reactionKey(messageId, userId, emoji))
    },
    async addReaction(messageId, userId, emoji) {
      reactions.add(reactionKey(messageId, userId, emoji))
    },
    async removeReaction(messageId, userId, emoji) {
      reactions.delete(reactionKey(messageId, userId, emoji))
    },
    async getPin(messageId) {
      const pinnedBy = pins.get(messageId)
      return pinnedBy ? { messageId, pinnedBy } : null
    },
    async addPin(messageId, userId) {
      pins.set(messageId, userId)
    },
    async removePin(messageId) {
      pins.delete(messageId)
    },
    async setReadState(input) {
      const existing = reads.find(
        (read) =>
          read.userId === input.userId &&
          read.channelId === input.channelId &&
          read.dmThreadId === input.dmThreadId,
      )
      if (existing) {
        existing.lastReadMessageId = input.lastReadMessageId
      } else {
        reads.push({ ...input })
      }
    },
  }
}

describe('message reactions', () => {
  it('keeps at most one reaction per user/message/emoji and toggles it off', async () => {
    const repository = fakeStateRepository()

    await expect(toggleReaction(repository, actor, 10, '👍')).resolves.toBe(true)
    expect(repository.reactions.size).toBe(1)

    await expect(toggleReaction(repository, actor, 10, '👍')).resolves.toBe(false)
    expect(repository.reactions.size).toBe(0)
  })

  it('rejects empty or oversized emoji keys', async () => {
    const repository = fakeStateRepository()

    await expect(toggleReaction(repository, actor, 10, '   ')).rejects.toThrow('REACTION_EMOJI_INVALID')
    await expect(toggleReaction(repository, actor, 10, 'x'.repeat(33))).rejects.toThrow(
      'REACTION_EMOJI_INVALID',
    )
  })
})

describe('message pins', () => {
  it('toggles a room-member pin on and off', async () => {
    const repository = fakeStateRepository()

    await expect(togglePin(repository, actor, 21)).resolves.toBe(true)
    expect(repository.pins.get(21)).toBe(actor.userId)

    await expect(togglePin(repository, actor, 21)).resolves.toBe(false)
    expect(repository.pins.has(21)).toBe(false)
  })
})

describe('read state and unread counts', () => {
  it('marks a channel or dm through one room target only', async () => {
    const repository = fakeStateRepository()

    await markRoomRead(repository, actor, { channelId: 'channel-a', dmThreadId: null }, 42)
    expect(repository.reads).toEqual([
      {
        userId: actor.userId,
        channelId: 'channel-a',
        dmThreadId: null,
        lastReadMessageId: 42,
      },
    ])

    await expect(
      markRoomRead(repository, actor, { channelId: 'channel-a', dmThreadId: 'dm-a' }, 42),
    ).rejects.toThrow('READ_STATE_TARGET_INVALID')
  })

  it('increments unread for new remote messages and resets after the room is marked read', () => {
    const other = '22222222-2222-2222-2222-222222222222'
    const messages = [
      {
        id: 10,
        channelId: 'channel-a',
        dmThreadId: null,
        senderId: other,
        deletedAt: null,
      },
      {
        id: 11,
        channelId: 'channel-a',
        dmThreadId: null,
        senderId: other,
        deletedAt: null,
      },
      {
        id: 12,
        channelId: 'channel-a',
        dmThreadId: null,
        senderId: actor.userId,
        deletedAt: null,
      },
      {
        id: 20,
        channelId: null,
        dmThreadId: 'dm-a',
        senderId: other,
        deletedAt: null,
      },
      {
        id: 21,
        channelId: null,
        dmThreadId: 'dm-a',
        senderId: other,
        deletedAt: '2026-10-22T00:00:00.000Z',
      },
    ]

    expect(
      getUnreadCounts(messages, [{ channelId: 'channel-a', dmThreadId: null, lastReadMessageId: 10 }], actor.userId),
    ).toEqual({
      channels: { 'channel-a': 1 },
      directMessages: { 'dm-a': 1 },
    })

    expect(
      getUnreadCounts(
        messages,
        [
          { channelId: 'channel-a', dmThreadId: null, lastReadMessageId: 12 },
          { channelId: null, dmThreadId: 'dm-a', lastReadMessageId: 20 },
        ],
        actor.userId,
      ),
    ).toEqual({
      channels: { 'channel-a': 0 },
      directMessages: { 'dm-a': 0 },
    })
  })
})
