import { describe, expect, it } from 'vitest'

import {
  mergeMessageHistory,
  messageRecordToRealtimeRow,
  toMessageListItems,
} from '@/lib/messages/presentation'
import type { MessageRecord } from '@/lib/messages/service'
import type { RealtimeMessageRow } from '@/lib/messages/realtime'

const profiles = [
  {
    userId: '11111111-1111-1111-1111-111111111111',
    displayName: 'Miles',
    username: 'miles',
    avatarPath: null,
  },
  {
    userId: '22222222-2222-2222-2222-222222222222',
    displayName: 'Teammate',
    username: 'team',
    avatarPath: null,
  },
]

function row(id: number, senderId = profiles[0]!.userId): RealtimeMessageRow {
  return {
    id,
    channel_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    dm_thread_id: null,
    sender_id: senderId,
    body: `message-${id}`,
    reply_to_id: null,
    created_at: `2026-10-21T00:00:${String(id).padStart(2, '0')}.000Z`,
    edited_at: null,
    deleted_at: null,
  }
}

describe('message presentation helpers', () => {
  it('merges older pages without duplicate ids and keeps chronological order', () => {
    const current = [row(3), row(4)]
    const older = [row(1), row(2), row(3)]

    expect(mergeMessageHistory(current, older).map((message) => message.id)).toEqual([1, 2, 3, 4])
  })

  it('resolves sender and reply metadata for MessageList rendering', () => {
    const parent = row(1)
    const reply = {
      ...row(2, profiles[1]!.userId),
      body: 'reply body',
      reply_to_id: 1,
    }

    const items = toMessageListItems([parent, reply], profiles)

    expect(items[1]).toMatchObject({
      sender: { displayName: 'Teammate', username: 'team' },
      replyTo: { id: 1, body: 'message-1', displayName: 'Miles' },
    })
  })

  it('maps server MessageRecord fields into the realtime/client row shape', () => {
    const record: MessageRecord = {
      id: 7,
      channelId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      dmThreadId: null,
      senderId: profiles[0]!.userId,
      body: 'hello',
      replyToId: null,
      createdAt: '2026-10-21T00:00:07.000Z',
      editedAt: null,
      deletedAt: null,
    }

    expect(messageRecordToRealtimeRow(record)).toEqual({
      id: 7,
      channel_id: record.channelId,
      dm_thread_id: null,
      sender_id: record.senderId,
      body: 'hello',
      reply_to_id: null,
      created_at: record.createdAt,
      edited_at: null,
      deleted_at: null,
    })
  })
})
