import { describe, expect, it } from 'vitest'

import { formatSeoulDateTime } from '@/lib/time/format'

describe('formatSeoulDateTime', () => {
  it('formats UTC timestamps in Asia/Seoul time', () => {
    const formatted = formatSeoulDateTime('2026-10-23T00:00:00.000Z')

    expect(formatted).toContain('2026')
    expect(formatted).toContain('10')
    expect(formatted).toContain('23')
    expect(formatted).toContain('09')
  })
})
