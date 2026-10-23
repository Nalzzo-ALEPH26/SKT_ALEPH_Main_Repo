import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('community management presentation', () => {
  it('keeps community pin management in the sidebar and out of each board page', () => {
    const sidebar = source('../../src/components/sidebar.tsx')
    const communityPage = source('../../src/app/(workspace)/community/[communityId]/page.tsx')
    const communityActions = source('../../src/app/(workspace)/community/community-actions.ts')

    expect(sidebar).toContain('선택한 커뮤니티 상단 고정')
    expect(sidebar).toContain('operation="pin"')
    expect(sidebar).toContain('operation="unpin"')
    expect(communityActions).toContain("operation !== 'delete' && operation !== 'pin' && operation !== 'unpin'")
    expect(communityActions).toContain(".from('community_pins')")
    expect(communityPage).not.toContain('setCommunityPinnedAction')
    expect(communityPage).not.toContain(".from('community_pins')")
  })

  it('keeps the sidebar fixed to the requested blue and cream palette and preserves creator comment pin controls', () => {
    const sidebar = source('../../src/components/sidebar.tsx')
    const globals = source('../../src/app/globals.css')
    const communityPage = source('../../src/app/(workspace)/community/[communityId]/page.tsx')

    expect(sidebar).toContain('bg-[#243b8f]')
    expect(sidebar).toContain('text-[#fff0c9]')
    expect(globals).toContain('background: #243b8f !important')
    expect(globals).toContain('color: #fff0c9 !important')
    expect(communityPage).toContain('const canPinComments = isAdmin || community.created_by === claims.sub')
    expect(communityPage).toContain('댓글 상단 고정')
  })

  it('applies the squeeze-style Latin font globally while exempting identifiers', () => {
    const layout = source('../../src/app/layout.tsx')
    const globals = source('../../src/app/globals.css')
    const messageItem = source('../../src/components/message-item.tsx')

    expect(layout).toContain('Fjalla_One')
    expect(layout).toContain("variable: '--font-squeeze'")
    expect(globals).toContain('font-family: var(--font-squeeze)')
    expect(globals).toContain('[data-identity-font="true"]')
    expect(globals).toContain('input[name="loginId"]')
    expect(messageItem).toContain('data-identity-font="true"')
  })
})
