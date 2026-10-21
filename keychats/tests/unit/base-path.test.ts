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
})
