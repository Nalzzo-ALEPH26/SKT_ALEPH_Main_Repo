import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/channel/design',
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock('@/app/(workspace)/dm/dm-actions', () => ({
  startDirectMessageAction: vi.fn(),
  manageDirectMessagesAction: vi.fn(),
}))
vi.mock('@/app/(workspace)/channel/channel-actions', () => ({
  createChannelAction: vi.fn(),
  joinChannelByCodeAction: vi.fn(),
  manageChannelsAction: vi.fn(),
}))
vi.mock('@/app/(workspace)/community/community-actions', () => ({
  createCommunityAction: vi.fn(),
  deleteCommunitiesAction: vi.fn(),
}))

import { AppShell } from '@/components/app-shell'
import { Avatar } from '@/components/avatar'
import { ThemeToggle } from '@/components/theme-toggle'

describe('workspace shell', () => {
  it('renders channel/direct sections with viewport-safe management popovers, community controls and feedback navigation', () => {
    const html = renderToStaticMarkup(
      createElement(
        AppShell,
        {
          profile: { displayName: 'Miles', avatarPath: null },
          currentUserId: '11111111-1111-1111-1111-111111111111',
          channelProfiles: [
            {
              userId: '33333333-3333-3333-3333-333333333333',
              displayName: 'New Teammate',
              username: 'new_teammate',
            },
          ],
          channels: [
            {
              id: 'general',
              name: 'general',
              unreadCount: 2,
              canLeave: true,
              canDelete: false,
            },
            {
              id: 'design',
              name: 'design',
              unreadCount: 0,
              canLeave: true,
              canDelete: true,
            },
          ],
          directMessages: [
            { id: 'dm-1', displayName: 'Teammate 1', unreadCount: 1 },
            { id: 'dm-2', displayName: 'Teammate 2', unreadCount: 0 },
            { id: 'dm-3', displayName: 'Teammate 3', unreadCount: 0 },
            { id: 'dm-4', displayName: 'Teammate 4', unreadCount: 0 },
            { id: 'dm-5', displayName: 'Teammate 5', unreadCount: 0 },
          ],
          directCandidates: [
            {
              userId: '33333333-3333-3333-3333-333333333333',
              displayName: 'New Teammate',
            },
          ],
          communities: [{ id: 'community-1', name: '자유게시판' }],
          isAdmin: true,
        },
        createElement('div', null, 'conversation'),
      ),
    )

    expect(html).toContain('KEYCHATS')
    expect(html).toContain('CHANNELS')
    expect(html).toContain('DIRECT')
    expect(html).toContain('#general')
    expect(html).toContain('data-channel-create-trigger="true"')
    expect(html).toContain('data-popover-side="right"')
    expect(html).toContain('채널 관리')
    expect(html).toContain('data-sidebar-popover-trigger="channel-management"')
    expect(html).toContain('data-popover-layout="viewport-safe"')
    expect(html).toContain('DM 관리')
    expect(html).toContain('data-sidebar-popover-trigger="dm-management"')
    expect(html).toContain('Teammate 5')
    expect(html).toContain('name="joinCode"')
    expect(html).toContain('100000 · General')
    expect(html).toContain('COMMUNITY')
    expect(html).toContain('href="/feedback"')
    expect(html).toContain('피드백')
    expect(html).toContain('href="/community/community-1"')
    expect(html).toContain('자유게시판')
    expect(html).toContain('data-sidebar-popover-trigger="new-community"')
    expect(html).toContain('data-sidebar-popover-trigger="community-management"')
    expect(html).toContain('커뮤니티 관리')
    expect(html).toContain('새 DM')
    expect(html).toContain('data-mobile-menu-trigger="true"')
    expect(html).toContain('data-unread-realtime-status="connecting"')
    expect(html).toContain('data-unread-badge="true"')
    expect(html).toContain('conversation')
  })

  it('shows admin-only entries and community deletion only to admins while community creation stays available', () => {
    const adminHtml = renderToStaticMarkup(
      createElement(AppShell, {
        profile: { displayName: 'Admin', avatarPath: null },
        channels: [],
        directMessages: [],
        communities: [{ id: 'community-1', name: '자유게시판' }],
        isAdmin: true,
      }),
    )
    const memberHtml = renderToStaticMarkup(
      createElement(AppShell, {
        profile: { displayName: 'Member', avatarPath: null },
        channels: [],
        directMessages: [],
        communities: [{ id: 'community-1', name: '자유게시판' }],
        isAdmin: false,
      }),
    )

    expect(adminHtml).toContain('관리자')
    expect(adminHtml).toContain('href="/admin"')
    expect(adminHtml).toContain('data-sidebar-popover-trigger="community-management"')
    expect(memberHtml).not.toContain('href="/admin"')
    expect(memberHtml).not.toContain('data-sidebar-popover-trigger="community-management"')
    expect(memberHtml).toContain('data-sidebar-popover-trigger="new-community"')
  })

  it('marks and styles the selected workspace theme', () => {
    const html = renderToStaticMarkup(
      createElement(
        AppShell,
        {
          profile: { displayName: 'Miles', avatarPath: null },
          channels: [],
          directMessages: [],
          theme: 'dark',
        },
        createElement('div', null, 'conversation'),
      ),
    )

    expect(html).toContain('data-theme="dark"')
    expect(html).toContain('bg-[#111111]')
  })

  it('uses the default avatar when no custom avatar exists', () => {
    const html = renderToStaticMarkup(
      createElement(Avatar, { displayName: 'Miles', avatarPath: null }),
    )

    expect(html).toContain('/chats/default-avatar.svg')
    expect(html).toContain('alt="Miles"')
  })

  it('makes the selected theme visually explicit', () => {
    const html = renderToStaticMarkup(createElement(ThemeToggle, { theme: 'dark' }))

    expect(html).toContain('Light')
    expect(html).toContain('Dark')
    expect(html).toContain('data-current-theme="dark"')
    expect(html).toContain('data-theme-selected="dark"')
    expect(html).toContain('✓')
  })
})
