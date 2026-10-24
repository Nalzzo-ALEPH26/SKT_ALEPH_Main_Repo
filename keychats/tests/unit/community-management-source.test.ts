import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('community and visual presentation', () => {
  it('treats the old feedback route as compatibility-only and marks notice communities as special', () => {
    const feedbackPage = source('../../src/app/(workspace)/feedback/page.tsx')
    const workspaceLayout = source('../../src/app/(workspace)/layout.tsx')
    const presentation = source('../../src/lib/sidebar/presentation.ts')
    const globals = source('../../src/app/globals.css')

    expect(feedbackPage).toContain(".eq('name', '피드백')")
    expect(feedbackPage).toContain('redirect(community ? `/community/${community.id}` : \'/\')')
    expect(workspaceLayout).toContain('is_notice')
    expect(workspaceLayout).toContain('isNotice: Boolean(community.is_notice)')
    expect(presentation).toContain('isNotice?: boolean')
    expect(globals).toContain('a[href$="/feedback"]')
  })

  it('lets a board creator moderate both posts and comments', () => {
    const communityPage = source('../../src/app/(workspace)/community/[communityId]/page.tsx')
    const actions = source('../../src/app/(workspace)/community/[communityId]/actions.ts')

    expect(communityPage).toContain('const canPinPosts = isAdmin || isCreator')
    expect(communityPage).toContain('const canPinComments = isAdmin || isCreator')
    expect(communityPage).toContain("{canPinPosts ? (")
    expect(actions).toContain('requireCommunityModerator')
    expect(actions).toContain(".from('community_post_pins')")
  })

  it('uses the global Fjalla stack without identifier-specific font overrides', () => {
    const layout = source('../../src/app/layout.tsx')
    const globals = source('../../src/app/globals.css')

    expect(layout).toContain('Fjalla_One')
    expect(layout).toContain("variable: '--font-squeeze'")
    expect(globals).toContain('font-family: var(--font-squeeze)')
    expect(globals).not.toContain('--font-identity')
    expect(globals).not.toContain('[data-identity-font="true"]')
  })

  it('matches sidebar plus controls and outlines other-user chat bubbles by theme', () => {
    const globals = source('../../src/app/globals.css')
    expect(globals).toContain('[data-channel-create-trigger]')
    expect(globals).toContain('color: rgb(255 240 201 / 65%) !important')
    expect(globals).toContain('[data-own-message="false"]')
    expect(globals).toContain('border: 1px solid #000')
    expect(globals).toContain('border-color: #fff')
  })

  it('adds a nickname form to settings', () => {
    const settingsPage = source('../../src/app/(workspace)/settings/page.tsx')
    const settingsActions = source('../../src/app/(workspace)/settings/actions.ts')
    expect(settingsPage).toContain('name="displayName"')
    expect(settingsPage).toContain('updateDisplayNameAction')
    expect(settingsActions).toContain(".update({ display_name: displayName")
    expect(settingsActions).toContain("revalidatePath('/', 'layout')")
  })
})
