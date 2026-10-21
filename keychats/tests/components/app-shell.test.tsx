import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AppShell } from '@/components/app-shell'
import { Avatar } from '@/components/avatar'
import { ThemeToggle } from '@/components/theme-toggle'

describe('workspace shell', () => {
  it('renders channel/direct sections and a mobile navigation trigger', () => {
    const html = renderToStaticMarkup(
      <AppShell
        profile={{ displayName: 'Miles', avatarPath: null }}
        channels={[{ id: 'general', name: 'general', unreadCount: 2 }]}
        directMessages={[{ id: 'dm-1', displayName: 'Teammate', unreadCount: 1 }]}
      >
        <div>conversation</div>
      </AppShell>,
    )

    expect(html).toContain('KEYCHATS')
    expect(html).toContain('CHANNELS')
    expect(html).toContain('DIRECT')
    expect(html).toContain('#general')
    expect(html).toContain('Teammate')
    expect(html).toContain('data-mobile-menu-trigger="true"')
    expect(html).toContain('conversation')
  })

  it('uses the default avatar when no custom avatar exists', () => {
    const html = renderToStaticMarkup(<Avatar displayName="Miles" avatarPath={null} />)

    expect(html).toContain('/chats/default-avatar.svg')
    expect(html).toContain('alt="Miles"')
  })

  it('renders exactly the Light and Dark choices with the current theme marked', () => {
    const html = renderToStaticMarkup(<ThemeToggle theme="dark" />)

    expect(html).toContain('Light')
    expect(html).toContain('Dark')
    expect(html).toContain('data-current-theme="dark"')
  })
})
