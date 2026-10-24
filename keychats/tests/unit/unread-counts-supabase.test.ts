import { describe, expect, it } from 'vitest'

import { mapUnreadCountRows } from '@/lib/messages/state-supabase'

describe('mapUnreadCountRows', () => {
  it('maps compact database rows without loading message history', () => {
    expect(
      mapUnreadCountRows([
        { room_type: 'channel', room_id: 'general-id', unread_count: 3 },
        { room_type: 'dm', room_id: 'dm-id', unread_count: 2 },
      ]),
    ).toEqual({
      channels: { 'general-id': 3 },
      directMessages: { 'dm-id': 2 },
    })
  })
})
