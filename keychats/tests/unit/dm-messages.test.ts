import { describe, expect, it, vi } from 'vitest'

import {
  loadDmMessages,
  sendDmMessage,
  type MessageActor,
  type MessageRecord,
  type MessageRepository,
} from '@/lib/messages/service'

const sender: MessageActor = {
  userId: '11111111-1111-1111-1111-111111111111',
  isAdmin: false,
}
const dmThreadId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const otherDmThreadId = 'dddddddd-dddd-dddd-dddd-dddddddddddd'

function message(overrides: Partial<MessageRecord> = {}): MessageRecord {
  return {
    id: 41,
    channelId: null,
    dmThreadId,
    senderId: sender.userId,
    body: 'hello',
    replyToId: null,
    createdAt: '2026-10-21T00:00:00.000Z',
    editedAt: null,
    deletedAt: null,
    ...overrides,
  }
}

function repository(): MessageRepository {
  return {
    getById: vi.fn().mockResolvedValue(message()),
    create: vi.fn().mockResolvedValue(message()),
    update: vi.fn().mockResolvedValue(message()),
    listChannel: vi.fn().mockResolvedValue([]),
    listDm: vi.fn().mockResolvedValue([message()]),
  }
}

describe('sendDmMessage', () => {
  it('derives sender identity and writes only the DM target', async () => {
    const repo = repository()

    await sendDmMessage(repo, sender, {
      dmThreadId,
      body: '  private hello  ',
    })

    expect(repo.create).toHaveBeenCalledWith({
      channelId: null,
      dmThreadId,
      senderId: sender.userId,
      body: 'private hello',
      replyToId: null,
    })
  })

  it('rejects a reply that points to another DM thread', async () => {
    const repo = repository()
    vi.mocked(repo.getById).mockResolvedValue(message({ id: 9, dmThreadId: otherDmThreadId }))

    await expect(
      sendDmMessage(repo, sender, { dmThreadId, body: 'reply', replyToId: 9 }),
    ).rejects.toThrow('MESSAGE_REPLY_ROOM_MISMATCH')
    expect(repo.create).not.toHaveBeenCalled()
  })
})

describe('loadDmMessages', () => {
  it('loads at most the newest 50 messages for the requested DM', async () => {
    const repo = repository()

    await loadDmMessages(repo, dmThreadId)

    expect(repo.listDm).toHaveBeenCalledWith({ dmThreadId, beforeId: null, limit: 50 })
  })

  it('passes the oldest loaded ID as the pagination cursor', async () => {
    const repo = repository()

    await loadDmMessages(repo, dmThreadId, 120)

    expect(repo.listDm).toHaveBeenCalledWith({ dmThreadId, beforeId: 120, limit: 50 })
  })
})
