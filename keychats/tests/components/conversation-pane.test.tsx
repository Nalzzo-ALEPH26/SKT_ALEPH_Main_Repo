import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/app/(workspace)/channel/message-actions', () => ({
  sendChannelMessageAction: vi.fn(),
  editChannelMessageAction: vi.fn(),
  deleteChannelMessageAction: vi.fn(),
  loadOlderChannelMessagesAction: vi.fn(),
  loadLatestChannelMessagesAction: vi.fn(),
}))
vi.mock('@/app/(workspace)/dm/message-actions', () => ({
  sendDmMessageAction: vi.fn(),
  editDmMessageAction: vi.fn(),
  deleteDmMessageAction: vi.fn(),
  loadOlderDmMessagesAction: vi.fn(),
  loadLatestDmMessagesAction: vi.fn(),
}))

import { ChannelMessagePane } from '@/components/channel-message-pane'
import { DmMessagePane } from '@/components/dm-message-pane'

const common = {
  initialMessages: [],
  profiles: [],
  currentUserId: '11111111-1111-1111-1111-111111111111',
  isAdmin: false,
}

describe('shared conversation pane', () => {
  it('preserves the channel marker for existing channel E2E behavior', () => {
    const html = renderToStaticMarkup(
      createElement(ChannelMessagePane, {
        channelId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        ...common,
      }),
    )

    expect(html).toContain('data-conversation-message-pane="true"')
    expect(html).toContain('data-channel-message-pane="true"')
    expect(html).not.toContain('data-dm-message-pane="true"')
  })

  it('keeps the composer pinned at the bottom with visible light-theme text', () => {
    const html = renderToStaticMarkup(
      createElement(ChannelMessagePane, {
        channelId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        ...common,
      }),
    )

    expect(html).toContain('data-sticky-composer="true"')
    expect(html).toContain('text-black')
    expect(html).toContain('border-black')
    expect(html).toContain('dark:text-white')
  })

  it('marks the message scroller for initial latest-message positioning', () => {
    const html = renderToStaticMarkup(
      createElement(ChannelMessagePane, {
        channelId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        ...common,
      }),
    )

    expect(html).toContain('data-message-scroll-area="true"')
  })

  it('renders the DM marker through the same conversation composer and list', () => {
    const html = renderToStaticMarkup(
      createElement(DmMessagePane, {
        dmThreadId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        ...common,
      }),
    )

    expect(html).toContain('data-conversation-message-pane="true"')
    expect(html).toContain('data-dm-message-pane="true"')
    expect(html).toContain('data-message-composer="true"')
  })
})
