import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/app/(workspace)/dm/dm-actions', () => ({
  startDirectMessageAction: vi.fn(),
}))

import { AppShell } from '@/components/app-shell'
import { Avatar } from '@/components/avatar'
import { ThemeToggle } from '@/components/theme-toggle'

describe('workspace shell', () => {
  it('renders channel/direct sections, new-DM candidates and a mobile navigation trigger', () => {
    const html = renderToStaticMarkup(
      createElement(
        AppShell,
        {
          profile: { displayName: 'Miles', avatarPath: null },
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
    expect(html).toContain('Teammate')
    expect(html).toContain('새 DM')
    expect(html).toContain('New Teammate')
    expect(html).toContain('name="otherUserId"')
    expect(html).toContain('value="33333333-3333-3333-3333-333333333333"')
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
    expect(adminHtml).toContain('href="/chats/admin"')
    expect(memberHtml).not.toContain('href="/chats/admin"')
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

  it('renders exactly the Light and Dark choices with the current theme marked', () => {
    const html = renderToStaticMarkup(createElement(ThemeToggle, { theme: 'dark' }))

    expect(html).toContain('Light')
    expect(html).toContain('Dark')
    expect(html).toContain('data-current-theme="dark"')
  })
})
