import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { createSupabaseDmRepository } from '@/lib/dms/supabase'

const pair = {
  userLow: '11111111-1111-1111-1111-111111111111',
  userHigh: '33333333-3333-3333-3333-333333333333',
}
const row = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  user_low: pair.userLow,
  user_high: pair.userHigh,
}

type QueryResult = { data: unknown; error: null | { code?: string; message?: string } }

function fakeSupabase(results: QueryResult[]) {
  const calls: Array<[string, ...unknown[]]> = []
  const remaining = [...results]
  const single = vi.fn(async () => remaining.shift() ?? { data: null, error: null })

  const client = {
    from: vi.fn((table: string) => {
      calls.push(['from', table])
      const query: Record<string, unknown> = {}
      const chain = (name: string) => (...args: unknown[]) => {
        calls.push([name, ...args])
        return query
      }
      const resolve = async () => remaining.shift() ?? { data: null, error: null }

      query.select = chain('select')
      query.eq = chain('eq')
      query.insert = chain('insert')
      query.maybeSingle = vi.fn(resolve)
      query.single = single
      query.then = (onFulfilled: (value: QueryResult) => unknown) => resolve().then(onFulfilled)
      return query
    }),
  }

  return { client, calls, single }
}

describe('createSupabaseDmRepository', () => {
  it('returns an existing canonical thread without inserting', async () => {
    const fake = fakeSupabase([{ data: row, error: null }])
    const repository = createSupabaseDmRepository(fake.client as never)

    const thread = await repository.getOrCreate(pair)

    expect(thread).toEqual({ id: row.id, userLow: pair.userLow, userHigh: pair.userHigh })
    expect(fake.calls).toContainEqual(['eq', 'user_low', pair.userLow])
    expect(fake.calls).toContainEqual(['eq', 'user_high', pair.userHigh])
    expect(fake.calls.some(([name]) => name === 'insert')).toBe(false)
  })

  it('inserts without RETURNING, then re-reads the canonical pair under participant SELECT RLS', async () => {
    const fake = fakeSupabase([
      { data: null, error: null },
      { data: null, error: null },
      { data: row, error: null },
    ])
    const repository = createSupabaseDmRepository(fake.client as never)

    const thread = await repository.getOrCreate(pair)

    expect(fake.calls).toContainEqual([
      'insert',
      { user_low: pair.userLow, user_high: pair.userHigh },
    ])
    expect(fake.single).not.toHaveBeenCalled()
    expect(fake.client.from).toHaveBeenCalledTimes(3)
    expect(thread.id).toBe(row.id)
  })

  it('re-reads the canonical thread after a concurrent unique conflict', async () => {
    const fake = fakeSupabase([
      { data: null, error: null },
      { data: null, error: { code: '23505', message: 'duplicate key' } },
      { data: row, error: null },
    ])
    const repository = createSupabaseDmRepository(fake.client as never)

    await expect(repository.getOrCreate(pair)).resolves.toEqual({
      id: row.id,
      userLow: pair.userLow,
      userHigh: pair.userHigh,
    })
    expect(fake.single).not.toHaveBeenCalled()
    expect(fake.client.from).toHaveBeenCalledTimes(3)
  })
})
