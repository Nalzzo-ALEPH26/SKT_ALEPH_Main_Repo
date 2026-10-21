import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { createSupabaseMessageRepository } from '@/lib/messages/supabase'

function messageRow(
  id: number,
  body = `message-${id}`,
  target: { channelId: string | null; dmThreadId: string | null } = {
    channelId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    dmThreadId: null,
  },
) {
  return {
    id,
    channel_id: target.channelId,
    dm_thread_id: target.dmThreadId,
    sender_id: '11111111-1111-1111-1111-111111111111',
    body,
    reply_to_id: null,
    created_at: `2026-10-21T00:00:${String(id).padStart(2, '0')}.000Z`,
    edited_at: null,
    deleted_at: null,
  }
}

type QueryResult = { data: unknown; error: unknown }

function fakeSupabase(result: QueryResult) {
  const calls: Array<[string, ...unknown[]]> = []
  const query: Record<string, unknown> = {}
  const chain = (name: string) => (...args: unknown[]) => {
    calls.push([name, ...args])
    return query
  }

  query.select = chain('select')
  query.eq = chain('eq')
  query.lt = chain('lt')
  query.order = chain('order')
  query.limit = chain('limit')
  query.insert = chain('insert')
  query.update = chain('update')
  query.maybeSingle = vi.fn(async () => result)
  query.single = vi.fn(async () => result)
  query.then = (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve)

  const client = {
    from: vi.fn((table: string) => {
      calls.push(['from', table])
      return query
    }),
  }

  return { client, calls }
}

describe('createSupabaseMessageRepository', () => {
  it('loads channel history with an explicit channel filter, cursor, descending query and limit', async () => {
    const fake = fakeSupabase({ data: [messageRow(9), messageRow(8)], error: null })
    const repository = createSupabaseMessageRepository(fake.client as never)

    const messages = await repository.listChannel({
      channelId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      beforeId: 10,
      limit: 50,
    })

    expect(fake.calls).toContainEqual(['from', 'messages'])
    expect(fake.calls).toContainEqual(['eq', 'channel_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'])
    expect(fake.calls).toContainEqual(['lt', 'id', 10])
    expect(fake.calls).toContainEqual(['order', 'id', { ascending: false }])
    expect(fake.calls).toContainEqual(['limit', 50])
    expect(messages.map((message) => message.id)).toEqual([8, 9])
  })

  it('loads DM history with an explicit dm_thread_id filter, cursor, descending query and limit', async () => {
    const dmThreadId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    const fake = fakeSupabase({
      data: [
        messageRow(9, 'message-9', { channelId: null, dmThreadId }),
        messageRow(8, 'message-8', { channelId: null, dmThreadId }),
      ],
      error: null,
    })
    const repository = createSupabaseMessageRepository(fake.client as never)

    const messages = await repository.listDm({ dmThreadId, beforeId: 10, limit: 50 })

    expect(fake.calls).toContainEqual(['from', 'messages'])
    expect(fake.calls).toContainEqual(['eq', 'dm_thread_id', dmThreadId])
    expect(fake.calls).toContainEqual(['lt', 'id', 10])
    expect(fake.calls).toContainEqual(['order', 'id', { ascending: false }])
    expect(fake.calls).toContainEqual(['limit', 50])
    expect(messages.map((message) => message.id)).toEqual([8, 9])
  })

  it('does not add a cursor predicate on the first page', async () => {
    const fake = fakeSupabase({ data: [], error: null })
    const repository = createSupabaseMessageRepository(fake.client as never)

    await repository.listChannel({
      channelId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      beforeId: null,
      limit: 50,
    })

    expect(fake.calls.some(([name]) => name === 'lt')).toBe(false)
  })

  it('maps insert fields to database columns and returns the inserted record', async () => {
    const fake = fakeSupabase({ data: messageRow(12, 'hello'), error: null })
    const repository = createSupabaseMessageRepository(fake.client as never)

    const created = await repository.create({
      channelId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      dmThreadId: null,
      senderId: '11111111-1111-1111-1111-111111111111',
      body: 'hello',
      replyToId: null,
    })

    expect(fake.calls).toContainEqual([
      'insert',
      {
        channel_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        dm_thread_id: null,
        sender_id: '11111111-1111-1111-1111-111111111111',
        body: 'hello',
        reply_to_id: null,
      },
    ])
    expect(created.id).toBe(12)
    expect(created.channelId).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  })
})
