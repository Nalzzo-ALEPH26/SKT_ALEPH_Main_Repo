import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { ChannelRecord, ChannelRepository } from '@/lib/channels/service'

function assertNoError(error: unknown, code: string): void {
  if (error) throw new Error(code, { cause: error })
}

function toRecord(row: {
  id: string
  name: string
  created_by: string
  is_default: boolean
  join_code: string
}): ChannelRecord {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    isDefault: row.is_default,
    joinCode: row.join_code,
  }
}

const CHANNEL_COLUMNS = 'id,name,created_by,is_default,join_code'

export function createSupabaseChannelRepository(admin: SupabaseClient): ChannelRepository {
  return {
    async findByNormalizedName(name) {
      const { data, error } = await admin.from('channels').select(CHANNEL_COLUMNS)
      assertNoError(error, 'CHANNEL_LOOKUP_FAILED')
      const found = (data ?? []).find(
        (row) => String(row.name).trim().toLocaleLowerCase('en-US') === name,
      )
      return found ? toRecord(found as never) : null
    },

    async findByJoinCode(joinCode) {
      const { data, error } = await admin
        .from('channels')
        .select(CHANNEL_COLUMNS)
        .eq('join_code', joinCode)
        .maybeSingle()
      assertNoError(error, 'CHANNEL_LOOKUP_FAILED')
      return data ? toRecord(data as never) : null
    },

    async getById(channelId) {
      const { data, error } = await admin
        .from('channels')
        .select(CHANNEL_COLUMNS)
        .eq('id', channelId)
        .maybeSingle()
      assertNoError(error, 'CHANNEL_LOOKUP_FAILED')
      return data ? toRecord(data as never) : null
    },

    async activeUserIds(userIds) {
      if (userIds.length === 0) return []
      const { data, error } = await admin
        .from('profiles')
        .select('user_id')
        .eq('status', 'active')
        .in('user_id', userIds)
      assertNoError(error, 'CHANNEL_MEMBER_LOOKUP_FAILED')
      return (data ?? []).map((row) => row.user_id as string)
    },

    async create(input) {
      const { data, error } = await admin
        .from('channels')
        .insert({ name: input.name, created_by: input.createdBy, is_default: false })
        .select('id')
        .single()
      assertNoError(error, 'CHANNEL_CREATE_FAILED')
      if (!data?.id) throw new Error('CHANNEL_CREATE_FAILED')
      return { id: data.id as string }
    },

    async addMember(channelId, userId, role) {
      const { error } = await admin.from('channel_members').upsert(
        { channel_id: channelId, user_id: userId, role },
        { onConflict: 'channel_id,user_id' },
      )
      assertNoError(error, 'CHANNEL_MEMBER_ADD_FAILED')
    },

    async removeMember(channelId, userId) {
      const { error } = await admin
        .from('channel_members')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', userId)
      assertNoError(error, 'CHANNEL_MEMBER_REMOVE_FAILED')
    },

    async memberCount(channelId) {
      const { count, error } = await admin
        .from('channel_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('channel_id', channelId)
      assertNoError(error, 'CHANNEL_MEMBER_LOOKUP_FAILED')
      return count ?? 0
    },

    async delete(channelId) {
      const { error } = await admin.from('channels').delete().eq('id', channelId)
      assertNoError(error, 'CHANNEL_DELETE_FAILED')
    },
  }
}
