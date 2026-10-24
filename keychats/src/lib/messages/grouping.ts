export const MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000

type GroupableMessage = {
  sender: { userId: string }
  createdAt: string
}

export function shouldGroupMessages(previous: GroupableMessage | undefined, current: GroupableMessage) {
  if (!previous || previous.sender.userId !== current.sender.userId) return false

  const previousTime = Date.parse(previous.createdAt)
  const currentTime = Date.parse(current.createdAt)
  if (!Number.isFinite(previousTime) || !Number.isFinite(currentTime)) return false

  const gap = currentTime - previousTime
  return gap >= 0 && gap <= MESSAGE_GROUP_WINDOW_MS
}
