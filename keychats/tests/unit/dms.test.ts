import { describe, expect, it, vi } from 'vitest'

import {
  canonicalDmPair,
  getOrCreateDm,
  type DmRepository,
  type DmThread,
} from '@/lib/dms/service'

const userA = '11111111-1111-1111-1111-111111111111'
const userB = '33333333-3333-3333-3333-333333333333'

function repository(thread: DmThread): DmRepository {
  return {
    getOrCreate: vi.fn().mockResolvedValue(thread),
  }
}

describe('canonicalDmPair', () => {
  it('sorts the two participants deterministically', () => {
    expect(canonicalDmPair(userB, userA)).toEqual({ userLow: userA, userHigh: userB })
    expect(canonicalDmPair(userA, userB)).toEqual({ userLow: userA, userHigh: userB })
  })

  it('rejects a direct message to self', () => {
    expect(() => canonicalDmPair(userA, userA)).toThrow('DM_SELF_FORBIDDEN')
  })
})

describe('getOrCreateDm', () => {
  it('uses the same canonical pair for A to B and B to A', async () => {
    const thread: DmThread = {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      userLow: userA,
      userHigh: userB,
    }
    const repo = repository(thread)

    const fromA = await getOrCreateDm(repo, userA, userB)
    const fromB = await getOrCreateDm(repo, userB, userA)

    expect(fromA).toEqual(thread)
    expect(fromB).toEqual(thread)
    expect(repo.getOrCreate).toHaveBeenNthCalledWith(1, { userLow: userA, userHigh: userB })
    expect(repo.getOrCreate).toHaveBeenNthCalledWith(2, { userLow: userA, userHigh: userB })
  })

  it('never calls the repository for self-DM', async () => {
    const repo = repository({
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      userLow: userA,
      userHigh: userB,
    })

    await expect(getOrCreateDm(repo, userA, userA)).rejects.toThrow('DM_SELF_FORBIDDEN')
    expect(repo.getOrCreate).not.toHaveBeenCalled()
  })
})
