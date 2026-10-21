import type { MessageListItem } from '@/components/message-item'
import type { RealtimeMessageRow } from '@/lib/messages/realtime'
import type { MessageRecord } from '@/lib/messages/service'

export type MessagePresentationProfile = {
  userId: string
  displayName: string
  username: string
  avatarPath: string | null
}

export function mergeMessageHistory(
  current: RealtimeMessageRow[],
  incoming: RealtimeMessageRow[],
): RealtimeMessageRow[] {
  const byId = new Map<number, RealtimeMessageRow>()

  for (const message of current) byId.set(message.id, message)
  for (const message of incoming) byId.set(message.id, message)

  return [...byId.values()].sort((left, right) => left.id - right.id)
}

export function messageRecordToRealtimeRow(record: MessageRecord): RealtimeMessageRow {
  return {
    id: record.id,
    channel_id: record.channelId,
    dm_thread_id: record.dmThreadId,
    sender_id: record.senderId,
    body: record.body,
    reply_to_id: record.replyToId,
    created_at: record.createdAt,
    edited_at: record.editedAt,
    deleted_at: record.deletedAt,
  }
}

export function toMessageListItems(
  messages: RealtimeMessageRow[],
  profiles: MessagePresentationProfile[],
): MessageListItem[] {
  const profilesById = new Map(profiles.map((profile) => [profile.userId, profile]))
  const messagesById = new Map(messages.map((message) => [message.id, message]))

  const senderFor = (userId: string) =>
    profilesById.get(userId) ?? {
      userId,
      displayName: '알 수 없는 사용자',
      username: 'unknown',
      avatarPath: null,
    }

  return messages.map((message) => {
    const sender = senderFor(message.sender_id)
    const parent = message.reply_to_id === null ? null : messagesById.get(message.reply_to_id)
    const replySender = parent ? senderFor(parent.sender_id) : null

    return {
      id: message.id,
      body: message.body,
      sender,
      replyTo:
        message.reply_to_id === null
          ? null
          : parent && replySender
            ? {
                id: parent.id,
                body: parent.body,
                displayName: replySender.displayName,
                deletedAt: parent.deleted_at,
              }
            : {
                id: message.reply_to_id,
                body: '이전 메시지',
                displayName: '이전 메시지',
                deletedAt: null,
              },
      createdAt: message.created_at,
      editedAt: message.edited_at,
      deletedAt: message.deleted_at,
    }
  })
}
