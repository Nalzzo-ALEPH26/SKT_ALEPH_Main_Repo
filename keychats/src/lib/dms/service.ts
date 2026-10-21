export type DmThread = {
  id: string
  userLow: string
  userHigh: string
}

export type DmPair = {
  userLow: string
  userHigh: string
}

export type DmRepository = {
  getOrCreate: (pair: DmPair) => Promise<DmThread>
}

export function canonicalDmPair(firstUserId: string, secondUserId: string): DmPair {
  if (firstUserId === secondUserId) throw new Error('DM_SELF_FORBIDDEN')

  return firstUserId < secondUserId
    ? { userLow: firstUserId, userHigh: secondUserId }
    : { userLow: secondUserId, userHigh: firstUserId }
}

export async function getOrCreateDm(
  repository: DmRepository,
  currentUserId: string,
  otherUserId: string,
): Promise<DmThread> {
  return repository.getOrCreate(canonicalDmPair(currentUserId, otherUserId))
}
