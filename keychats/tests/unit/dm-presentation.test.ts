import { describe, expect, it } from 'vitest'

import { buildDirectSidebarData, counterpartUserId } from '@/lib/dms/presentation'

const userA = '11111111-1111-1111-1111-111111111111'
const userB = '33333333-3333-3333-3333-333333333333'
const userC = '55555555-5555-5555-5555-555555555555'

describe('counterpartUserId', () => {
  it('returns the other participant from either side of the canonical pair', () => {
    expect(counterpartUserId({ userLow: userA, userHigh: userB }, userA)).toBe(userB)
    expect(counterpartUserId({ userLow: userA, userHigh: userB }, userB)).toBe(userA)
  })

  it('rejects a viewer who is not a participant', () => {
    expect(() =>
      counterpartUserId(
        { userLow: userA, userHigh: userB },
        userC,
      ),
    ).toThrow('DM_NOT_PARTICIPANT')
  })
})

describe('buildDirectSidebarData', () => {
  const profiles = [
    { userId: userA, displayName: 'Alpha' },
    { userId: userB, displayName: 'Beta' },
    { userId: userC, displayName: 'Gamma' },
  ]

  it('maps visible threads to the counterpart display name and excludes self from candidates', () => {
    const result = buildDirectSidebarData(
      userA,
      profiles,
      [
        { id: 'dm-ab', userLow: userA, userHigh: userB },
        { id: 'dm-ac', userLow: userA, userHigh: userC },
      ],
    )

    expect(result.directMessages).toEqual([
      { id: 'dm-ab', displayName: 'Beta', unreadCount: 0 },
      { id: 'dm-ac', displayName: 'Gamma', unreadCount: 0 },
    ])
    expect(result.directCandidates).toEqual([
      { userId: userB, displayName: 'Beta' },
      { userId: userC, displayName: 'Gamma' },
    ])
  })

  it('filters threads hidden by the current user while keeping the counterpart as a DM candidate', () => {
    const result = buildDirectSidebarData(
      userA,
      profiles,
      [
        { id: 'dm-ab', userLow: userA, userHigh: userB },
        { id: 'dm-ac', userLow: userA, userHigh: userC },
      ],
      new Set(['dm-ab']),
    )

    expect(result.directMessages).toEqual([
      { id: 'dm-ac', displayName: 'Gamma', unreadCount: 0 },
    ])
    expect(result.directCandidates).toContainEqual({ userId: userB, displayName: 'Beta' })
  })

  it('uses a stable fallback label if the counterpart profile is unavailable', () => {
    const result = buildDirectSidebarData(
      userA,
      [{ userId: userA, displayName: 'Alpha' }],
      [{ id: 'dm-ab', userLow: userA, userHigh: userB }],
    )

    expect(result.directMessages).toEqual([
      { id: 'dm-ab', displayName: '알 수 없는 사용자', unreadCount: 0 },
    ])
  })
})
