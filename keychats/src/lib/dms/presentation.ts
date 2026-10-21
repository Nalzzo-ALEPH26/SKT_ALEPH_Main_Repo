export function counterpartUserId(
  pair: { userLow: string; userHigh: string },
  currentUserId: string,
) {
  if (pair.userLow === currentUserId) return pair.userHigh
  if (pair.userHigh === currentUserId) return pair.userLow
  throw new Error('DM_NOT_PARTICIPANT')
}
