import { describe, expect, it } from 'vitest'

import { shouldRefreshForUnknownDmThread } from '@/lib/dms/sidebar-refresh'

describe('DM sidebar refresh', () => {
  it('refreshes when a message arrives for a DM thread missing from the current sidebar snapshot', () => {
    const knownDmIds = new Set(['dm-1', 'dm-2', 'dm-3', 'dm-4'])

    expect(shouldRefreshForUnknownDmThread('dm-5', knownDmIds)).toBe(true)
    expect(shouldRefreshForUnknownDmThread('dm-4', knownDmIds)).toBe(false)
    expect(shouldRefreshForUnknownDmThread(null, knownDmIds)).toBe(false)
  })
})
