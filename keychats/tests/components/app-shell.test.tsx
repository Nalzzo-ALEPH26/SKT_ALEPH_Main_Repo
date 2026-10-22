import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/app/(workspace)/dm/dm-actions', () => ({
  startDirectMessageAction: vi.fn(),
}))
vi.mock('@/app/(workspace)/channel/channel-actions', () => ({
  createChannelAction: vi.fn(),
  joinChannelByCodeAction: vi.fn(),
}))

import { AppShell } from '@/components/app-shell'
import { Avatar } from '@/components/avatar'
import { ThemeToggle } from '@/components/theme-toggle'

describe('workspace shell', () => {
  it('renders channel/direct sections, channel creation, join-by-code and feedback navigation', () => {
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
          channels: [{ id: 'general', name: 'general', unreadCount: 2 }],
          directMessages: [{ id: 'dm-1', displayName: 'Teammate', unreadCount: 1 }],
          directCandidates: [
            {
              userId: '33333333-3333-3333-3333-333333333333',
              displayName: 'New Teammate',
            },
          ],
        },
        createElement('div', null, 'conversation'),
      ),
    )

    expect(html).toContain('KEYCHATS')
    expect(html).toContain('CHANNELS')
    expect(html).toContain('DIRECT')
    expect(html).toContain('#general')
    expect(html).toContain('data-channel-create-trigger="true"')
    expect(html).toContain('name="joinCode"')
    expect(html).toContain('100000 · General')
    expect(html).toContain('href="/feedback"')
    expect(html).toContain('피드백')
    expect(html).toContain('새 DM')
    expect(html).toContain('data-mobile-menu-trigger="true"')
    expect(html).toContain('conversation')
  })

  it('shows the admin entry only to admins', () => {
    const adminHtml = renderToStaticMarkup(
      createElement(AppShell, {
        profile: { displayName: 'Admin', avatarPath: null },
        channels: [],
        directMessages: [],
        isAdmin: true,
      }),
    )
    const memberHtml = renderToStaticMarkup(
      createElement(AppShell, {
        profile: { displayName: 'Member', avatarPath: null },
        channels: [],
        directMessages: [],
        isAdmin: false,
      }),
    )

    expect(adminHtml).toContain('관리자')
    expect(adminHtml).toContain('href="/admin"')
    expect(memberHtml).not.toContain('href="/admin"')
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
