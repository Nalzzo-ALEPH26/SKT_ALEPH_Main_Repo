import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ChannelDialog } from '@/components/channel-dialog'
import { MemberDialog } from '@/components/member-dialog'

const profiles = [
  { userId: '11111111-1111-1111-1111-111111111111', displayName: 'Miles', username: 'cxu1344' },
  { userId: '22222222-2222-2222-2222-222222222222', displayName: 'Teammate', username: 'member2' },
]

describe('ChannelDialog', () => {
  it('renders a channel name field and selectable active teammates', () => {
    const html = renderToStaticMarkup(
      createElement(ChannelDialog, {
        profiles,
        currentUserId: profiles[0].userId,
      }),
    )

    expect(html).toContain('채널 만들기')
    expect(html).toContain('name="name"')
    expect(html).toContain('name="memberIds"')
    expect(html).toContain('Teammate')
    expect(html).not.toContain('value="11111111-1111-1111-1111-111111111111"')
  })
})

describe('MemberDialog', () => {
  it('shows member management only when the actor can manage the channel', () => {
    const html = renderToStaticMarkup(
      createElement(MemberDialog, {
        channelId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        members: [profiles[0]],
        candidates: [profiles[1]],
        canManage: true,
        canDelete: false,
        isDefault: false,
      }),
    )

    expect(html).toContain('멤버 관리')
    expect(html).toContain('Teammate')
    expect(html).toContain('name="addUserId"')
    expect(html).not.toContain('채널 삭제')
  })

  it('never exposes delete control for the default channel', () => {
    const html = renderToStaticMarkup(
      createElement(MemberDialog, {
        channelId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        members: profiles,
        candidates: [],
        canManage: true,
        canDelete: true,
        isDefault: true,
      }),
    )

    expect(html).not.toContain('채널 삭제')
  })
})
