import { describe, expect, it } from 'vitest'

import { counterpartUserId } from '@/lib/dms/presentation'

const userA = '11111111-1111-1111-1111-111111111111'
const userB = '33333333-3333-3333-3333-333333333333'

describe('counterpartUserId', () => {
  it('returns the other participant from either side of the canonical pair', () => {
    expect(counterpartUserId({ userLow: userA, userHigh: userB }, userA)).toBe(userB)
    expect(counterpartUserId({ userLow: userA, userHigh: userB }, userB)).toBe(userA)
  })

  it('rejects a viewer who is not a participant', () => {
    expect(() =>
      counterpartUserId(
        { userLow: userA, userHigh: userB },
        '55555555-5555-5555-5555-555555555555',
      ),
    ).toThrow('DM_NOT_PARTICIPANT')
  })
})
