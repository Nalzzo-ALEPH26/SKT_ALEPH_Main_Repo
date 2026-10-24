import { describe, expect, it, vi } from 'vitest'

import {
  deleteMessage,
  editMessage,
  loadChannelMessages,
  sendChannelMessage,
  type MessageActor,
  type MessageRecord,
  type MessageRepository,
} from '@/lib/messages/service'

const sender: MessageActor = {
  userId: '11111111-1111-1111-1111-111111111111',
  isAdmin: false,
}
const other: MessageActor = {
  userId: '22222222-2222-2222-2222-222222222222',
  isAdmin: false,
}
const admin: MessageActor = {
  userId: '55555555-5555-5555-5555-555555555555',
  isAdmin: true,
}
const channelId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const otherChannelId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

function message(overrides: Partial<MessageRecord> = {}): MessageRecord {
  return {
    id: 41,
    channelId,
    dmThreadId: null,
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
    listChannel: vi.fn().mockResolvedValue([message()]),
    listDm: vi.fn().mockResolvedValue([]),
  }
}

describe('sendChannelMessage', () => {
  it('derives sender identity from the authenticated actor', async () => {
    const repo = repository()

    await sendChannelMessage(repo, sender, {
      channelId,
      body: '  hello team  ',
    })

    expect(repo.create).toHaveBeenCalledWith({
      channelId,
      dmThreadId: null,
      senderId: sender.userId,
      body: 'hello team',
      replyToId: null,
    })
  })

  it('rejects a blank-only message without an attachment', async () => {
    const repo = repository()

    await expect(
      sendChannelMessage(repo, sender, { channelId, body: '   ', attachmentCount: 0 }),
    ).rejects.toThrow('MESSAGE_EMPTY')
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('allows an empty body when an attachment will be associated with the message', async () => {
    const repo = repository()

    await sendChannelMessage(repo, sender, { channelId, body: '', attachmentCount: 1 })

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ senderId: sender.userId, body: null }),
    )
  })

  it('rejects replies that point to another room', async () => {
    const repo = repository()
    vi.mocked(repo.getById).mockResolvedValue(message({ id: 9, channelId: otherChannelId }))

    await expect(
      sendChannelMessage(repo, sender, { channelId, body: 'reply', replyToId: 9 }),
    ).rejects.toThrow('MESSAGE_REPLY_ROOM_MISMATCH')
    expect(repo.create).not.toHaveBeenCalled()
  })
})

describe('editMessage', () => {
  it('allows only the sender to edit a live message and sets editedAt', async () => {
    const repo = repository()
    const editedAt = new Date('2026-10-21T03:00:00.000Z')

    await editMessage(repo, sender, 41, ' changed ', editedAt)

    expect(repo.update).toHaveBeenCalledWith(41, {
      body: 'changed',
      editedAt: editedAt.toISOString(),
    })
  })

  it('denies another member from editing the message', async () => {
    const repo = repository()

    await expect(editMessage(repo, other, 41, 'changed')).rejects.toThrow('MESSAGE_EDIT_FORBIDDEN')
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('does not allow a deleted message to be edited again', async () => {
    const repo = repository()
    vi.mocked(repo.getById).mockResolvedValue(
      message({ deletedAt: '2026-10-21T03:30:00.000Z', body: null }),
    )

    await expect(editMessage(repo, sender, 41, 'changed')).rejects.toThrow('MESSAGE_DELETED')
    expect(repo.update).not.toHaveBeenCalled()
  })
})

describe('deleteMessage', () => {
  it('soft deletes the sender message and clears its body', async () => {
    const repo = repository()
    const deletedAt = new Date('2026-10-21T04:00:00.000Z')

    await deleteMessage(repo, sender, 41, deletedAt)

    expect(repo.update).toHaveBeenCalledWith(41, {
      body: null,
      deletedAt: deletedAt.toISOString(),
    })
  })

  it('denies another ordinary member from deleting it', async () => {
    const repo = repository()

    await expect(deleteMessage(repo, other, 41)).rejects.toThrow('MESSAGE_DELETE_FORBIDDEN')
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('allows admin moderation for channel messages but not implicit DM access', async () => {
    const repo = repository()

    await deleteMessage(repo, admin, 41)
    expect(repo.update).toHaveBeenCalled()

    vi.mocked(repo.update).mockClear()
    vi.mocked(repo.getById).mockResolvedValue(
      message({ channelId: null, dmThreadId: 'cccccccc-cccc-cccc-cccc-cccccccccccc' }),
    )

    await expect(deleteMessage(repo, admin, 41)).rejects.toThrow('MESSAGE_DELETE_FORBIDDEN')
    expect(repo.update).not.toHaveBeenCalled()
  })
})

describe('loadChannelMessages', () => {
  it('loads at most the newest 50 messages for the requested channel', async () => {
    const repo = repository()

    await loadChannelMessages(repo, channelId)

    expect(repo.listChannel).toHaveBeenCalledWith({ channelId, beforeId: null, limit: 50 })
  })

  it('passes the oldest loaded ID as the pagination cursor', async () => {
    const repo = repository()

    await loadChannelMessages(repo, channelId, 120)

    expect(repo.listChannel).toHaveBeenCalledWith({ channelId, beforeId: 120, limit: 50 })
  })
})
