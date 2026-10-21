import { describe, expect, it } from 'vitest'

import { normalizeTheme } from '@/lib/settings/theme'

describe('normalizeTheme', () => {
  it.each(['light', 'dark'] as const)('accepts %s', (theme) => {
    expect(normalizeTheme(theme)).toBe(theme)
  })

  it.each(['system', '', 'DARK', null, undefined])('rejects unsupported theme %s', (theme) => {
    expect(() => normalizeTheme(theme)).toThrow('THEME_INVALID')
  })
})
