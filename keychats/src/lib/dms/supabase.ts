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

      const { data, error } = await client
        .from('dm_threads')
        .insert({ user_low: pair.userLow, user_high: pair.userHigh })
        .select(DM_COLUMNS)
        .single()

      if (!error && data) return mapThread(data as DmRow)

      if ((error as DatabaseError | null)?.code === '23505') {
        const raced = await findThread(client, pair)
        if (raced) return raced
      }

      fail(error as DatabaseError | null, 'DM_CREATE_FAILED')
    },
  }
}
