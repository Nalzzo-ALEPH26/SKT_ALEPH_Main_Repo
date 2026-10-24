export type DirectProfile = {
  userId: string
  displayName: string
}

export type DirectThread = {
  id: string
  userLow: string
  userHigh: string
}

export function counterpartUserId(
  pair: { userLow: string; userHigh: string },
  currentUserId: string,
) {
  if (pair.userLow === currentUserId) return pair.userHigh
  if (pair.userHigh === currentUserId) return pair.userLow
  throw new Error('DM_NOT_PARTICIPANT')
}

export function buildDirectSidebarData(
  currentUserId: string,
  profiles: DirectProfile[],
  threads: DirectThread[],
  hiddenThreadIds: ReadonlySet<string> = new Set(),
) {
  const profileById = new Map(profiles.map((profile) => [profile.userId, profile]))

  return {
    directMessages: threads
      .filter((thread) => !hiddenThreadIds.has(thread.id))
      .map((thread) => {
        const otherUserId = counterpartUserId(thread, currentUserId)
        return {
          id: thread.id,
          displayName: profileById.get(otherUserId)?.displayName ?? '알 수 없는 사용자',
          unreadCount: 0,
        }
      }),
    directCandidates: profiles
      .filter((profile) => profile.userId !== currentUserId)
      .map((profile) => ({
        userId: profile.userId,
        displayName: profile.displayName,
      })),
  }
}
