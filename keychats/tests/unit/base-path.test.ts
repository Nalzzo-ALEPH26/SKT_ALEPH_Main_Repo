import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import nextConfig from '../../next.config'

describe('Keychats base path', () => {
  it('uses /chats and renders the shell marker at the root app', () => {
    expect(nextConfig.basePath).toBe('/chats')

    const rootPage = readFileSync(resolve(process.cwd(), 'src/app/page.tsx'), 'utf8')
    expect(rootPage).toContain('data-keychats-shell')
  })

  it('redirects the bare production hostname root into the configured base path', () => {
    const vercelConfig = JSON.parse(
      readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'),
    ) as {
      redirects?: Array<{ source: string; destination: string; permanent?: boolean }>
    }

    expect(vercelConfig.redirects).toContainEqual({
      source: '/',
      destination: '/chats',
      permanent: false,
    })
  })

  it('keeps server redirects relative to the configured base path', () => {
    const loginActions = readFileSync(resolve(process.cwd(), 'src/app/login/actions.ts'), 'utf8')
    const inviteActions = readFileSync(
      resolve(process.cwd(), 'src/app/invite/[token]/actions.ts'),
      'utf8',
    )

    expect(loginActions).not.toMatch(/redirect\(["'`]\/chats(?:[\/"'`?])/)
    expect(inviteActions).not.toMatch(/redirect\(["'`]\/chats(?:[\/"'`?])/)
  })
})
