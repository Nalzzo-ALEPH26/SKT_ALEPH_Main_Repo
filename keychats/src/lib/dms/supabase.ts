import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { DmPair, DmRepository, DmThread } from '@/lib/dms/service'

const DM_COLUMNS = 'id,user_low,user_high'

type DmRow = {
  id: string
  user_low: string
  user_high: string
}

type DatabaseError = {
  code?: string
  message?: string
}

function mapThread(row: DmRow): DmThread {
  return {
    id: row.id,
    userLow: row.user_low,
    userHigh: row.user_high,
  }
}

function fail(error: DatabaseError | null, fallback: string): never {
  throw new Error(error?.message || fallback)
}

async function findThread(client: SupabaseClient, pair: DmPair): Promise<DmThread | null> {
  const { data, error } = await client
    .from('dm_threads')
    .select(DM_COLUMNS)
    .eq('user_low', pair.userLow)
    .eq('user_high', pair.userHigh)
    .maybeSingle()

  if (error) fail(error, 'DM_READ_FAILED')
  return data ? mapThread(data as DmRow) : null
}

export function createSupabaseDmRepository(client: SupabaseClient): DmRepository {
  return {
    async getOrCreate(pair) {
      const existing = await findThread(client, pair)
      if (existing) return existing

      const { error } = await client
        .from('dm_threads')
        .insert({ user_low: pair.userLow, user_high: pair.userHigh })

      if (!error) {
        const created = await findThread(client, pair)
        if (created) return created
        fail(null, 'DM_CREATE_READ_FAILED')
      }

      if ((error as DatabaseError | null)?.code === '23505') {
        const raced = await findThread(client, pair)
        if (raced) return raced
      }

      fail(error as DatabaseError | null, 'DM_CREATE_FAILED')
    },

    async hide(threadIds, userId) {
      for (const threadId of threadIds) {
        const { error } = await client
          .from('dm_hidden_threads')
          .insert({ dm_thread_id: threadId, user_id: userId })
        if (error && (error as DatabaseError).code !== '23505') {
          fail(error as DatabaseError, 'DM_HIDE_FAILED')
        }
      }
    },

    async unhide(threadId, userId) {
      const { error } = await client
        .from('dm_hidden_threads')
        .delete()
        .eq('dm_thread_id', threadId)
        .eq('user_id', userId)
      if (error) fail(error as DatabaseError, 'DM_UNHIDE_FAILED')
    },
  }
}
