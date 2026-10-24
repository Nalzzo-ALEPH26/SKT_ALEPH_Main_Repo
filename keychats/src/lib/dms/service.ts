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
  hide: (threadIds: string[], userId: string) => Promise<void>
  unhide: (threadId: string, userId: string) => Promise<void>
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
  const thread = await repository.getOrCreate(canonicalDmPair(currentUserId, otherUserId))
  await repository.unhide(thread.id, currentUserId)
  return thread
}

export async function hideDirectMessages(
  repository: DmRepository,
  currentUserId: string,
  threadIds: string[],
) {
  const uniqueThreadIds = [...new Set(threadIds.map((id) => id.trim()).filter(Boolean))]
  if (uniqueThreadIds.length === 0) throw new Error('DM_THREAD_IDS_REQUIRED')
  await repository.hide(uniqueThreadIds, currentUserId)
}
