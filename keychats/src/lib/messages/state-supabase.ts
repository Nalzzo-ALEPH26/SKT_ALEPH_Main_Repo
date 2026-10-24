import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  MessageStateRepository,
  UnreadMessage,
  UnreadReadState,
} from '@/lib/messages/service'

type DatabaseError = {
  message?: string
}

type ReactionRow = {
  message_id: number
  user_id: string
  emoji: string
}

type PinRow = {
  message_id: number
  pinned_by?: string
}

type ReadStateRow = {
  id?: string
  channel_id: string | null
  dm_thread_id: string | null
  last_read_message_id: number | null
}

type UnreadMessageRow = {
  id: number
  channel_id: string | null
  dm_thread_id: string | null
  sender_id: string
  deleted_at: string | null
}

export type UnreadCountRow = {
  room_type: 'channel' | 'dm'
  room_id: string
  unread_count: number | string
}

export type ReactionSummary = {
  emoji: string
  count: number
  reactedByCurrentUser: boolean
}

export type MessageStateSnapshot = Record<
  number,
  {
    isPinned: boolean
    reactions: ReactionSummary[]
  }
>

function fail(error: DatabaseError | null, fallback: string): never {
  throw new Error(error?.message || fallback)
}

async function execute(query: PromiseLike<{ error: DatabaseError | null }>, fallback: string) {
  const { error } = await query
  if (error) fail(error, fallback)
}

export function createSupabaseMessageStateRepository(
  client: SupabaseClient,
): MessageStateRepository {
  return {
    async hasReaction(messageId, userId, emoji) {
      const { data, error } = await client
        .from('message_reactions')
        .select('message_id')
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('emoji', emoji)
        .maybeSingle()

      if (error) fail(error, 'REACTION_READ_FAILED')
      return data !== null
    },

    async addReaction(messageId, userId, emoji) {
      await execute(
        client.from('message_reactions').insert({
          message_id: messageId,
          user_id: userId,
          emoji,
        }),
        'REACTION_ADD_FAILED',
      )
    },

    async removeReaction(messageId, userId, emoji) {
      await execute(
        client
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', userId)
          .eq('emoji', emoji),
        'REACTION_REMOVE_FAILED',
      )
    },

    async getPin(messageId) {
      const { data, error } = await client
        .from('message_pins')
        .select('message_id,pinned_by')
        .eq('message_id', messageId)
        .maybeSingle()

      if (error) fail(error, 'PIN_READ_FAILED')
      if (!data) return null

      const row = data as PinRow
      return {
        messageId: row.message_id,
        pinnedBy: row.pinned_by ?? '',
      }
    },

    async addPin(messageId, userId) {
      await execute(
        client.from('message_pins').insert({
          message_id: messageId,
          pinned_by: userId,
        }),
        'PIN_ADD_FAILED',
      )
    },

    async removePin(messageId) {
      await execute(
        client.from('message_pins').delete().eq('message_id', messageId),
        'PIN_REMOVE_FAILED',
      )
    },

    async setReadState(input) {
      let lookup = client
        .from('read_states')
        .select('id')
        .eq('user_id', input.userId)

      lookup = input.channelId
        ? lookup.eq('channel_id', input.channelId).is('dm_thread_id', null)
        : lookup.eq('dm_thread_id', input.dmThreadId).is('channel_id', null)

      const { data: existing, error: lookupError } = await lookup.maybeSingle()
      if (lookupError) fail(lookupError, 'READ_STATE_READ_FAILED')

      const patch = {
        last_read_message_id: input.lastReadMessageId,
        updated_at: new Date().toISOString(),
      }

      if (existing) {
        await execute(
          client.from('read_states').update(patch).eq('id', (existing as { id: string }).id),
          'READ_STATE_UPDATE_FAILED',
        )
        return
      }

      await execute(
        client.from('read_states').insert({
          user_id: input.userId,
          channel_id: input.channelId,
          dm_thread_id: input.dmThreadId,
          ...patch,
        }),
        'READ_STATE_INSERT_FAILED',
      )
    },
  }
}

export async function loadMessageStateSnapshot(
  client: SupabaseClient,
  messageIds: number[],
  currentUserId: string,
): Promise<MessageStateSnapshot> {
  if (messageIds.length === 0) return {}

  const { data: reactionData, error: reactionError } = await client
    .from('message_reactions')
    .select('message_id,user_id,emoji')
    .in('message_id', messageIds)
  if (reactionError) fail(reactionError, 'REACTION_LIST_FAILED')

  const { data: pinData, error: pinError } = await client
    .from('message_pins')
    .select('message_id')
    .in('message_id', messageIds)
  if (pinError) fail(pinError, 'PIN_LIST_FAILED')

  const snapshot: MessageStateSnapshot = {}
  const pinned = new Set((pinData ?? []).map((row) => (row as PinRow).message_id))
  const reactionsByMessage = new Map<number, Map<string, ReactionSummary>>()

  for (const raw of reactionData ?? []) {
    const row = raw as ReactionRow
    let byEmoji = reactionsByMessage.get(row.message_id)
    if (!byEmoji) {
      byEmoji = new Map()
      reactionsByMessage.set(row.message_id, byEmoji)
    }

    const current = byEmoji.get(row.emoji) ?? {
      emoji: row.emoji,
      count: 0,
      reactedByCurrentUser: false,
    }
    current.count += 1
    if (row.user_id === currentUserId) current.reactedByCurrentUser = true
    byEmoji.set(row.emoji, current)
  }

  for (const messageId of messageIds) {
    snapshot[messageId] = {
      isPinned: pinned.has(messageId),
      reactions: [...(reactionsByMessage.get(messageId)?.values() ?? [])],
    }
  }

  return snapshot
}

export function mapUnreadCountRows(rows: UnreadCountRow[]) {
  const channels: Record<string, number> = {}
  const directMessages: Record<string, number> = {}

  for (const row of rows) {
    const count = Number(row.unread_count)
    if (!Number.isFinite(count) || count <= 0) continue
    if (row.room_type === 'channel') channels[row.room_id] = count
    if (row.room_type === 'dm') directMessages[row.room_id] = count
  }

  return { channels, directMessages }
}

export async function loadUnreadCounts(client: SupabaseClient) {
  const { data, error } = await client.rpc('get_unread_counts')
  if (error) fail(error, 'UNREAD_COUNTS_FAILED')
  return mapUnreadCountRows((data ?? []) as UnreadCountRow[])
}

export async function loadUnreadInputs(client: SupabaseClient, currentUserId: string) {
  const { data: messageData, error: messageError } = await client
    .from('messages')
    .select('id,channel_id,dm_thread_id,sender_id,deleted_at')
  if (messageError) fail(messageError, 'UNREAD_MESSAGES_FAILED')

  const { data: readData, error: readError } = await client
    .from('read_states')
    .select('channel_id,dm_thread_id,last_read_message_id')
    .eq('user_id', currentUserId)
  if (readError) fail(readError, 'UNREAD_READ_STATES_FAILED')

  const messages: UnreadMessage[] = (messageData ?? []).map((raw) => {
    const row = raw as UnreadMessageRow
    return {
      id: row.id,
      channelId: row.channel_id,
      dmThreadId: row.dm_thread_id,
      senderId: row.sender_id,
      deletedAt: row.deleted_at,
    }
  })

  const readStates: UnreadReadState[] = (readData ?? []).map((raw) => {
    const row = raw as ReadStateRow
    return {
      channelId: row.channel_id,
      dmThreadId: row.dm_thread_id,
      lastReadMessageId: row.last_read_message_id,
    }
  })

  return { messages, readStates }
}
