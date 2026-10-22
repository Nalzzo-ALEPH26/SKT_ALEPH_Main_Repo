import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { MessageList } from '@/components/message-list'

const sender = {
  userId: '11111111-1111-1111-1111-111111111111',
  displayName: 'Sender',
  username: 'sender',
  avatarPath: null,
}

function render(messages: Parameters<typeof MessageList>[0]['messages']) {
  return renderToStaticMarkup(
    createElement(MessageList, {
      messages,
      currentUserId: sender.userId,
      isAdmin: false,
    }),
  )
}

describe('MessageList', () => {
  it('places the current users message and profile on the right', () => {
    const html = render([
      {
        id: 1,
        body: 'mine',
        sender,
        replyTo: null,
        createdAt: '2026-10-21T00:00:00.000Z',
        editedAt: null,
        deletedAt: null,
      },
    ])
    expect(html).toContain('data-own-message="true"')
    expect(html).toContain('justify-end')
    expect(html).toContain('data-message-avatar-side="right"')
  })

  it('keeps other users messages on the left', () => {
    const html = render([
      {
        id: 2,
        body: 'theirs',
        sender: { ...sender, userId: '22222222-2222-2222-2222-222222222222' },
        replyTo: null,
        createdAt: '2026-10-21T00:00:00.000Z',
        editedAt: null,
        deletedAt: null,
      },
    ])
    expect(html).toContain('data-own-message="false"')
    expect(html).toContain('data-message-avatar-side="left"')
  })

  it('shows the exact edited indicator for a live edited message', () => {
    const html = render([
      {
        id: 3,
        body: 'changed',
        sender,
        replyTo: null,
        createdAt: '2026-10-21T00:00:00.000Z',
        editedAt: '2026-10-21T00:01:00.000Z',
        deletedAt: null,
      },
    ])

    expect(html).toContain('changed')
    expect(html).toContain('(수정됨)')
  })

  it('renders an exact tombstone and hides the deleted body', () => {
    const html = render([
      {
        id: 4,
        body: 'secret old body',
        sender,
        replyTo: null,
        createdAt: '2026-10-21T00:00:00.000Z',
        editedAt: null,
        deletedAt: '2026-10-21T00:02:00.000Z',
      },
    ])

    expect(html).toContain('삭제된 메시지입니다.')
    expect(html).not.toContain('secret old body')
  })

  it('shows the referenced message excerpt for replies', () => {
    const html = render([
      {
        id: 5,
        body: 'answer',
        sender,
        replyTo: {
          id: 1,
          body: 'original question',
          displayName: 'Teammate',
          deletedAt: null,
        },
        createdAt: '2026-10-21T00:03:00.000Z',
        editedAt: null,
        deletedAt: null,
      },
    ])

    expect(html).toContain('original question')
    expect(html).toContain('Teammate')
  })

  it('renders reaction counts, the current users reaction state and a pinned marker', () => {
    const html = render([
      {
        id: 6,
        body: 'react to me',
        sender,
        replyTo: null,
        createdAt: '2026-10-21T00:04:00.000Z',
        editedAt: null,
        deletedAt: null,
        isPinned: true,
        reactions: [
          { emoji: '👍', count: 2, reactedByCurrentUser: true },
          { emoji: '🎉', count: 1, reactedByCurrentUser: false },
        ],
      },
    ])

    expect(html).toContain('고정됨')
    expect(html).toContain('data-reaction-emoji="👍"')
    expect(html).toContain('data-reacted-by-current-user="true"')
    expect(html).toContain('👍 2')
    expect(html).toContain('🎉 1')
  })
})
