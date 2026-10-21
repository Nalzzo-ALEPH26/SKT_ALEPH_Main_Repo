import { describe, expect, it, vi } from 'vitest'

import {
  reconcileMessageChange,
  subscribeToChannelMessages,
  subscribeToDmMessages,
  type RealtimeMessageRow,
} from '@/lib/messages/realtime'

const channelId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const dmThreadId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

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
  const realtimeChannel = {
    on: vi.fn((_: string, options: { event: string; filter: string }) => {
      handlers.push({ event: options.event, filter: options.filter })
      return realtimeChannel
    }),
    subscribe: vi.fn(() => realtimeChannel),
  }
  const client = {
    channel: vi.fn(() => realtimeChannel),
    removeChannel: vi.fn(),
  }

  return { client, realtimeChannel, handlers }
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
