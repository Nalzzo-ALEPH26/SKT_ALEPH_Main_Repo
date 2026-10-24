import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { MessageRecord, MessageRepository } from '@/lib/messages/service'

const MESSAGE_COLUMNS =
  'id, channel_id, dm_thread_id, sender_id, body, reply_to_id, created_at, edited_at, deleted_at'

type MessageRow = {
  id: number
  channel_id: string | null
  dm_thread_id: string | null
  sender_id: string
  body: string | null
  reply_to_id: number | null
  created_at: string
  edited_at: string | null
  deleted_at: string | null
}

function mapMessage(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    channelId: row.channel_id,
    dmThreadId: row.dm_thread_id,
    senderId: row.sender_id,
    body: row.body,
    replyToId: row.reply_to_id,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
  }
}

function fail(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback)
}

function mapHistory(rows: MessageRow[] | null): MessageRecord[] {
  return (rows ?? []).map(mapMessage).reverse()
}

export function createSupabaseMessageRepository(client: SupabaseClient): MessageRepository {
  return {
    async getById(id) {
      const { data, error } = await client
        .from('messages')
        .select(MESSAGE_COLUMNS)
        .eq('id', id)
        .maybeSingle()

      if (error) fail(error, 'MESSAGE_READ_FAILED')
      return data ? mapMessage(data as MessageRow) : null
    },

    async create(input) {
      const { data, error } = await client
        .from('messages')
        .insert({
          channel_id: input.channelId,
          dm_thread_id: input.dmThreadId,
          sender_id: input.senderId,
          body: input.body,
          reply_to_id: input.replyToId,
        })
        .select(MESSAGE_COLUMNS)
        .single()

      if (error || !data) fail(error, 'MESSAGE_CREATE_FAILED')
      return mapMessage(data as MessageRow)
    },

    async update(id, patch) {
      const databasePatch: Record<string, string | null> = {}
      if ('body' in patch) databasePatch.body = patch.body ?? null
      if ('editedAt' in patch) databasePatch.edited_at = patch.editedAt ?? null
      if ('deletedAt' in patch) databasePatch.deleted_at = patch.deletedAt ?? null

      const { data, error } = await client
        .from('messages')
        .update(databasePatch)
        .eq('id', id)
        .select(MESSAGE_COLUMNS)
        .single()

      if (error || !data) fail(error, 'MESSAGE_UPDATE_FAILED')
      return mapMessage(data as MessageRow)
    },

    async listChannel({ channelId, beforeId, limit }) {
      let query = client
        .from('messages')
        .select(MESSAGE_COLUMNS)
        .eq('channel_id', channelId)
        .order('id', { ascending: false })
        .limit(limit)

      if (beforeId !== null) {
        query = query.lt('id', beforeId)
      }

      const { data, error } = await query
      if (error) fail(error, 'MESSAGE_LIST_FAILED')

      return mapHistory((data ?? []) as MessageRow[])
    },

    async listDm({ dmThreadId, beforeId, limit }) {
      let query = client
        .from('messages')
        .select(MESSAGE_COLUMNS)
        .eq('dm_thread_id', dmThreadId)
        .order('id', { ascending: false })
        .limit(limit)

      if (beforeId !== null) {
        query = query.lt('id', beforeId)
      }

      const { data, error } = await query
      if (error) fail(error, 'MESSAGE_LIST_FAILED')

      return mapHistory((data ?? []) as MessageRow[])
    },
  }
}
