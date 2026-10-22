import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  createSupabaseMessageStateRepository,
  loadMessageStateSnapshot,
  loadUnreadInputs,
} from '@/lib/messages/state-supabase'

type Result = { data: unknown; error: unknown }

function fakeSupabase(results: Result[]) {
  const calls: Array<[string, ...unknown[]]> = []
  const queue = [...results]
  const query: Record<string, unknown> = {}
  const chain = (name: string) => (...args: unknown[]) => {
    calls.push([name, ...args])
    return query
  }
  const resolve = async () => queue.shift() ?? { data: null, error: null }

  query.select = chain('select')
  query.eq = chain('eq')
  query.in = chain('in')
  query.is = chain('is')
  query.insert = chain('insert')
  query.update = chain('update')
  query.delete = chain('delete')
  query.maybeSingle = vi.fn(resolve)
  query.then = (onFulfilled: (value: Result) => unknown) => resolve().then(onFulfilled)

  const client = {
    from: vi.fn((table: string) => {
      calls.push(['from', table])
      return query
    }),
  }

  return { client, calls }
}

describe('createSupabaseMessageStateRepository', () => {
  it('toggles reaction rows through the current user/message/emoji key', async () => {
    const fake = fakeSupabase([
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ])
    const repository = createSupabaseMessageStateRepository(fake.client as never)

    await expect(repository.hasReaction(7, 'user-a', '👍')).resolves.toBe(false)
    await repository.addReaction(7, 'user-a', '👍')
    await repository.removeReaction(7, 'user-a', '👍')

    expect(fake.calls).toContainEqual(['from', 'message_reactions'])
    expect(fake.calls).toContainEqual(['eq', 'message_id', 7])
    expect(fake.calls).toContainEqual(['eq', 'user_id', 'user-a'])
    expect(fake.calls).toContainEqual(['eq', 'emoji', '👍'])
    expect(fake.calls).toContainEqual([
      'insert',
      { message_id: 7, user_id: 'user-a', emoji: '👍' },
    ])
  })

  it('updates an existing read marker instead of inserting a duplicate target row', async () => {
    const fake = fakeSupabase([
      { data: { id: 'read-1' }, error: null },
      { data: null, error: null },
    ])
    const repository = createSupabaseMessageStateRepository(fake.client as never)

    await repository.setReadState({
      userId: 'user-a',
      channelId: 'channel-a',
      dmThreadId: null,
      lastReadMessageId: 42,
    })

    expect(fake.calls).toContainEqual(['eq', 'user_id', 'user-a'])
    expect(fake.calls).toContainEqual(['eq', 'channel_id', 'channel-a'])
    expect(fake.calls).toContainEqual(['is', 'dm_thread_id', null])
    expect(fake.calls).toContainEqual([
      'update',
      expect.objectContaining({ last_read_message_id: 42 }),
    ])
    expect(fake.calls).toContainEqual(['eq', 'id', 'read-1'])
  })
})

describe('message-state loaders', () => {
  it('aggregates reactions and pins for loaded messages', async () => {
    const fake = fakeSupabase([
      {
        data: [
          { message_id: 10, user_id: 'user-a', emoji: '👍' },
          { message_id: 10, user_id: 'user-b', emoji: '👍' },
          { message_id: 10, user_id: 'user-b', emoji: '🎉' },
        ],
        error: null,
      },
      { data: [{ message_id: 10 }], error: null },
    ])

    const snapshot = await loadMessageStateSnapshot(fake.client as never, [10], 'user-a')

    expect(snapshot[10]).toEqual({
      isPinned: true,
      reactions: [
        { emoji: '👍', count: 2, reactedByCurrentUser: true },
        { emoji: '🎉', count: 1, reactedByCurrentUser: false },
      ],
    })
    expect(fake.calls).toContainEqual(['in', 'message_id', [10]])
  })

  it('loads only the current users read states alongside accessible message markers', async () => {
    const fake = fakeSupabase([
      {
        data: [
          {
            id: 2,
            channel_id: 'channel-a',
            dm_thread_id: null,
            sender_id: 'user-b',
            deleted_at: null,
          },
        ],
        error: null,
      },
      {
        data: [
          {
            channel_id: 'channel-a',
            dm_thread_id: null,
            last_read_message_id: 1,
          },
        ],
        error: null,
      },
    ])

    const inputs = await loadUnreadInputs(fake.client as never, 'user-a')

    expect(inputs.messages).toEqual([
      {
        id: 2,
        channelId: 'channel-a',
        dmThreadId: null,
        senderId: 'user-b',
        deletedAt: null,
      },
    ])
    expect(inputs.readStates).toEqual([
      { channelId: 'channel-a', dmThreadId: null, lastReadMessageId: 1 },
    ])
    expect(fake.calls).toContainEqual(['eq', 'user_id', 'user-a'])
  })
})
