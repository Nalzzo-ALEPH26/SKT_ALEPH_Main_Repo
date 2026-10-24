import { describe, expect, it, vi } from 'vitest'

import {
  reconcileMessageChange,
  subscribeToChannelMessages,
  subscribeToDmMessages,
  type RealtimeMessageRow,
} from '@/lib/messages/realtime'

const channelId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const dmThreadId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

type TestSystemPayload = {
  extension?: string
  status?: string
  message?: string
}

type TestRealtimePayload = { new: RealtimeMessageRow } | TestSystemPayload

function row(id: number, body: string): RealtimeMessageRow {
  return {
    id,
    channel_id: channelId,
    dm_thread_id: null,
    sender_id: '11111111-1111-1111-1111-111111111111',
    body,
    reply_to_id: null,
    created_at: `2026-10-21T00:00:${String(id).padStart(2, '0')}.000Z`,
    edited_at: null,
    deleted_at: null,
  }
}

function fakeRealtimeClient() {
  const handlers: Array<{ event: string; filter: string }> = []
  let statusHandler: ((status: string) => void) | undefined
  let systemHandler: ((payload: TestSystemPayload) => void) | undefined

  const realtimeChannel = {
    on: vi.fn((type: string, options: unknown, callback: (payload: TestRealtimePayload) => void) => {
      if (type === 'system') {
        systemHandler = callback as (payload: TestSystemPayload) => void
      } else {
        const postgresOptions = options as { event: string; filter: string }
        handlers.push({ event: postgresOptions.event, filter: postgresOptions.filter })
      }
      return realtimeChannel
    }),
    subscribe: vi.fn((callback?: (status: string) => void) => {
      statusHandler = callback
      return realtimeChannel
    }),
  }
  const client = {
    channel: vi.fn(() => realtimeChannel),
    removeChannel: vi.fn(),
  }

  return {
    client,
    realtimeChannel,
    handlers,
    emitStatus: (status: string) => statusHandler?.(status),
    emitSystem: (payload: TestSystemPayload) => systemHandler?.(payload),
  }
}

describe('reconcileMessageChange', () => {
  it('upserts by id instead of duplicating an optimistic/existing row', () => {
    const current = [row(1, 'old')]

    const next = reconcileMessageChange(current, row(1, 'new'))

    expect(next).toHaveLength(1)
    expect(next[0]?.body).toBe('new')
  })

  it('keeps messages ordered by ascending id after an insert', () => {
    const next = reconcileMessageChange([row(3, 'three'), row(1, 'one')], row(2, 'two'))
    expect(next.map((message) => message.id)).toEqual([1, 2, 3])
  })
})

describe('subscribeToChannelMessages', () => {
  it('subscribes only to INSERT and UPDATE events for the current channel', () => {
    const { client, realtimeChannel, handlers } = fakeRealtimeClient()
    const onChange = vi.fn()

    const unsubscribe = subscribeToChannelMessages(client, channelId, onChange)

    expect(client.channel).toHaveBeenCalledWith(`messages:channel:${channelId}`)
    expect(handlers).toEqual([
      { event: 'INSERT', filter: `channel_id=eq.${channelId}` },
      { event: 'UPDATE', filter: `channel_id=eq.${channelId}` },
    ])
    expect(realtimeChannel.subscribe).toHaveBeenCalledOnce()

    unsubscribe()
    expect(client.removeChannel).toHaveBeenCalledWith(realtimeChannel)
  })

  it('reports READY only after the postgres_changes system subscription is live', () => {
    const { client, emitStatus, emitSystem } = fakeRealtimeClient()
    const onStatus = vi.fn()

    subscribeToChannelMessages(client, channelId, vi.fn(), onStatus)
    emitStatus('SUBSCRIBED')
    expect(onStatus).not.toHaveBeenCalled()

    emitSystem({ extension: 'postgres_changes', status: 'ok', message: 'Subscribed to PostgreSQL' })
    expect(onStatus).toHaveBeenCalledWith('READY')
  })

  it('surfaces postgres_changes system errors as a degraded status', () => {
    const { client, emitSystem } = fakeRealtimeClient()
    const onStatus = vi.fn()

    subscribeToChannelMessages(client, channelId, vi.fn(), onStatus)
    emitSystem({ extension: 'postgres_changes', status: 'error', message: 'failed' })

    expect(onStatus).toHaveBeenCalledWith('POSTGRES_ERROR')
  })
})

describe('subscribeToDmMessages', () => {
  it('subscribes only to INSERT and UPDATE events for the current DM thread', () => {
    const { client, realtimeChannel, handlers } = fakeRealtimeClient()
    const onChange = vi.fn()

    const unsubscribe = subscribeToDmMessages(client, dmThreadId, onChange)

    expect(client.channel).toHaveBeenCalledWith(`messages:dm:${dmThreadId}`)
    expect(handlers).toEqual([
      { event: 'INSERT', filter: `dm_thread_id=eq.${dmThreadId}` },
      { event: 'UPDATE', filter: `dm_thread_id=eq.${dmThreadId}` },
    ])
    expect(realtimeChannel.subscribe).toHaveBeenCalledOnce()

    unsubscribe()
    expect(client.removeChannel).toHaveBeenCalledWith(realtimeChannel)
  })
})
