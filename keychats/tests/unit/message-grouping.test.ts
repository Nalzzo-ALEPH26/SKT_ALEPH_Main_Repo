import { describe, expect, it } from 'vitest'

import { MESSAGE_GROUP_WINDOW_MS, shouldGroupMessages } from '@/lib/messages/grouping'

const sender = (userId: string, createdAt: string) => ({ sender: { userId }, createdAt })

describe('message grouping', () => {
  it('groups consecutive messages from the same sender within five minutes', () => {
    const first = sender('user-a', '2026-10-23T00:00:00.000Z')
    const second = sender('user-a', '2026-10-23T00:04:59.000Z')
    expect(shouldGroupMessages(first, second)).toBe(true)
  })

  it('starts a new group when the sender changes', () => {
    const first = sender('user-a', '2026-10-23T00:00:00.000Z')
    const second = sender('user-b', '2026-10-23T00:00:10.000Z')
    expect(shouldGroupMessages(first, second)).toBe(false)
  })

  it('starts a new group after the five minute window', () => {
    const first = sender('user-a', '2026-10-23T00:00:00.000Z')
    const second = sender('user-a', new Date(Date.parse(first.createdAt) + MESSAGE_GROUP_WINDOW_MS + 1).toISOString())
    expect(shouldGroupMessages(first, second)).toBe(false)
  })
})
