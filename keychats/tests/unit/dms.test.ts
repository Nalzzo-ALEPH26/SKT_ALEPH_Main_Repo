import { describe, expect, it, vi } from 'vitest'

import {
  canonicalDmPair,
  getOrCreateDm,
  hideDirectMessages,
  type DmRepository,
  type DmThread,
} from '@/lib/dms/service'

const userA = '11111111-1111-1111-1111-111111111111'
const userB = '33333333-3333-3333-3333-333333333333'

function repository(thread: DmThread): DmRepository {
  return {
    getOrCreate: vi.fn().mockResolvedValue(thread),
    hide: vi.fn().mockResolvedValue(undefined),
    unhide: vi.fn().mockResolvedValue(undefined),
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
  it('uses the same canonical pair and restores the thread for the current user', async () => {
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
    expect(repo.unhide).toHaveBeenNthCalledWith(1, thread.id, userA)
    expect(repo.unhide).toHaveBeenNthCalledWith(2, thread.id, userB)
  })

  it('never calls the repository for self-DM', async () => {
    const repo = repository({
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      userLow: userA,
      userHigh: userB,
    })

    await expect(getOrCreateDm(repo, userA, userA)).rejects.toThrow('DM_SELF_FORBIDDEN')
    expect(repo.getOrCreate).not.toHaveBeenCalled()
    expect(repo.unhide).not.toHaveBeenCalled()
  })
})

describe('hideDirectMessages', () => {
  it('deduplicates selected threads before hiding them for the current user', async () => {
    const repo = repository({
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      userLow: userA,
      userHigh: userB,
    })

    await hideDirectMessages(repo, userA, ['dm-1', 'dm-1', 'dm-2'])

    expect(repo.hide).toHaveBeenCalledWith(['dm-1', 'dm-2'], userA)
  })
})
