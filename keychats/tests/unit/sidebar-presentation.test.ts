import { describe, expect, it } from 'vitest'

import { isSidebarHrefActive, sortSidebarCommunities } from '@/lib/sidebar/presentation'

describe('sidebar presentation', () => {
  it('puts notice first, then pinned communities newest pin first', () => {
    const sorted = sortSidebarCommunities([
      { id: 'normal', name: '일반' },
      { id: 'old-pin', name: '오래된 고정', pinnedAt: '2026-10-23T00:00:00.000Z' },
      { id: 'notice', name: '공지사항', isNotice: true },
      { id: 'new-pin', name: '새 고정', pinnedAt: '2026-10-23T01:00:00.000Z' },
    ])

    expect(sorted.map((community) => community.id)).toEqual(['notice', 'new-pin', 'old-pin', 'normal'])
  })

  it('marks a base-path-prefixed current room as active', () => {
    expect(isSidebarHrefActive('/chats/channel/abc', '/channel/abc')).toBe(true)
    expect(isSidebarHrefActive('/chats/community/xyz', '/community/xyz')).toBe(true)
    expect(isSidebarHrefActive('/chats/channel/other', '/channel/abc')).toBe(false)
  })
})
