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

function message(id: number, body: string, createdAt: string, userId = sender.userId) {
  return {
    id,
    body,
    sender: { ...sender, userId },
    replyTo: null,
    createdAt,
    editedAt: null,
    deletedAt: null,
  }
}

describe('MessageList', () => {
  it('places the current users message and profile on the right', () => {
    const html = render([message(1, 'mine', '2026-10-21T00:00:00.000Z')])
    expect(html).toContain('data-own-message="true"')
    expect(html).toContain('justify-end')
    expect(html).toContain('data-message-avatar-side="right"')
  })

  it('keeps other users messages on the left', () => {
    const html = render([message(2, 'theirs', '2026-10-21T00:00:00.000Z', '22222222-2222-2222-2222-222222222222')])
    expect(html).toContain('data-own-message="false"')
    expect(html).toContain('data-message-avatar-side="left"')
  })

  it('shows sender metadata only once for consecutive messages from the same sender', () => {
    const html = render([
      message(10, 'first', '2026-10-21T00:00:00.000Z'),
      message(11, 'second', '2026-10-21T00:01:00.000Z'),
      message(12, 'third', '2026-10-21T00:02:00.000Z'),
    ])

    expect((html.match(/data-message-sender-meta/g) ?? []).length).toBe(1)
    expect((html.match(/data-message-group-continuation="true"/g) ?? []).length).toBe(2)
    expect(html).toContain('first')
    expect(html).toContain('second')
    expect(html).toContain('third')
  })

  it('starts a new visible sender group after five minutes', () => {
    const html = render([
      message(20, 'first', '2026-10-21T00:00:00.000Z'),
      message(21, 'later', '2026-10-21T00:05:01.000Z'),
    ])
    expect((html.match(/data-message-sender-meta/g) ?? []).length).toBe(2)
  })

  it('shows the exact edited indicator for a live edited message', () => {
    const html = render([
      {
        ...message(3, 'changed', '2026-10-21T00:00:00.000Z'),
        editedAt: '2026-10-21T00:01:00.000Z',
      },
    ])

    expect(html).toContain('changed')
    expect(html).toContain('(수정됨)')
  })

  it('renders an exact tombstone and hides the deleted body', () => {
    const html = render([
      {
        ...message(4, 'secret old body', '2026-10-21T00:00:00.000Z'),
        deletedAt: '2026-10-21T00:02:00.000Z',
      },
    ])

    expect(html).toContain('삭제된 메시지입니다.')
    expect(html).not.toContain('secret old body')
  })

  it('shows the referenced message excerpt for replies', () => {
    const html = render([
      {
        ...message(5, 'answer', '2026-10-21T00:03:00.000Z'),
        replyTo: {
          id: 1,
          body: 'original question',
          displayName: 'Teammate',
          deletedAt: null,
        },
      },
    ])

    expect(html).toContain('original question')
    expect(html).toContain('Teammate')
  })

  it('renders reaction counts, the current users reaction state and a pinned marker', () => {
    const html = render([
      {
        ...message(6, 'react to me', '2026-10-21T00:04:00.000Z'),
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

  it('keeps a pinned marker visible on a grouped continuation message', () => {
    const html = render([
      message(30, 'first', '2026-10-21T00:00:00.000Z'),
      { ...message(31, 'pinned followup', '2026-10-21T00:01:00.000Z'), isPinned: true },
    ])
    expect(html).toContain('data-message-group-continuation="true"')
    expect(html).toContain('고정됨')
  })
})
