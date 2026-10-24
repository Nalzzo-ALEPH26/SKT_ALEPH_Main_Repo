export type MessageActor = {
  userId: string
  isAdmin: boolean
}

export type MessageRecord = {
  id: number
  channelId: string | null
  dmThreadId: string | null
  senderId: string
  body: string | null
  replyToId: number | null
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
}

export type CreateMessageInput = {
  channelId: string | null
  dmThreadId: string | null
  senderId: string
  body: string | null
  replyToId: number | null
}

export type MessageUpdate = {
  body?: string | null
  editedAt?: string
  deletedAt?: string
}

export type MessageRepository = {
  getById: (messageId: number) => Promise<MessageRecord | null>
  create: (input: CreateMessageInput) => Promise<MessageRecord>
  update: (messageId: number, patch: MessageUpdate) => Promise<MessageRecord>
  listChannel: (input: {
    channelId: string
    beforeId: number | null
    limit: number
  }) => Promise<MessageRecord[]>
  listDm: (input: {
    dmThreadId: string
    beforeId: number | null
    limit: number
  }) => Promise<MessageRecord[]>
}

export type ReadStateTarget = {
  channelId: string | null
  dmThreadId: string | null
}

export type MessageStateRepository = {
  hasReaction: (messageId: number, userId: string, emoji: string) => Promise<boolean>
  addReaction: (messageId: number, userId: string, emoji: string) => Promise<void>
  removeReaction: (messageId: number, userId: string, emoji: string) => Promise<void>
  getPin: (messageId: number) => Promise<{ messageId: number; pinnedBy: string } | null>
  addPin: (messageId: number, userId: string) => Promise<void>
  removePin: (messageId: number) => Promise<void>
  setReadState: (input: {
    userId: string
    channelId: string | null
    dmThreadId: string | null
    lastReadMessageId: number | null
  }) => Promise<void>
}

export type UnreadMessage = {
  id: number
  channelId: string | null
  dmThreadId: string | null
  senderId: string
  deletedAt: string | null
}

export type UnreadReadState = ReadStateTarget & {
  lastReadMessageId: number | null
}

type SendMessageBase = {
  body?: string | null
  replyToId?: number | null
  attachmentCount?: number
}

type SendChannelMessageInput = SendMessageBase & {
  channelId: string
}

type SendDmMessageInput = SendMessageBase & {
  dmThreadId: string
}

function normalizedBody(body: string | null | undefined): string | null {
  const value = body?.trim() ?? ''
  return value.length > 0 ? value : null
}

function assertValidAttachmentCount(value: number | undefined): number {
  const count = value ?? 0
  if (!Number.isInteger(count) || count < 0) throw new Error('ATTACHMENT_COUNT_INVALID')
  return count
}

async function assertReplyInRoom(
  repository: MessageRepository,
  replyToId: number | null,
  target: { channelId: string | null; dmThreadId: string | null },
) {
  if (replyToId === null) return

  const parent = await repository.getById(replyToId)
  if (!parent || parent.deletedAt) throw new Error('MESSAGE_REPLY_INVALID')
  if (parent.channelId !== target.channelId || parent.dmThreadId !== target.dmThreadId) {
    throw new Error('MESSAGE_REPLY_ROOM_MISMATCH')
  }
}

async function sendMessage(
  repository: MessageRepository,
  actor: MessageActor,
  input: SendMessageBase,
  target: { channelId: string | null; dmThreadId: string | null },
) {
  const body = normalizedBody(input.body)
  const attachmentCount = assertValidAttachmentCount(input.attachmentCount)
  if (!body && attachmentCount === 0) throw new Error('MESSAGE_EMPTY')

  const replyToId = input.replyToId ?? null
  await assertReplyInRoom(repository, replyToId, target)

  return repository.create({
    ...target,
    senderId: actor.userId,
    body,
    replyToId,
  })
}

export async function sendChannelMessage(
  repository: MessageRepository,
  actor: MessageActor,
  input: SendChannelMessageInput,
) {
  return sendMessage(repository, actor, input, {
    channelId: input.channelId,
    dmThreadId: null,
  })
}

export async function sendDmMessage(
  repository: MessageRepository,
  actor: MessageActor,
  input: SendDmMessageInput,
) {
  return sendMessage(repository, actor, input, {
    channelId: null,
    dmThreadId: input.dmThreadId,
  })
}

export async function editMessage(
  repository: MessageRepository,
  actor: MessageActor,
  messageId: number,
  nextBody: string,
  now = new Date(),
) {
  const current = await repository.getById(messageId)
  if (!current) throw new Error('MESSAGE_NOT_FOUND')
  if (current.deletedAt) throw new Error('MESSAGE_DELETED')
  if (current.senderId !== actor.userId) throw new Error('MESSAGE_EDIT_FORBIDDEN')

  const body = normalizedBody(nextBody)
  if (!body) throw new Error('MESSAGE_EMPTY')

  return repository.update(messageId, {
    body,
    editedAt: now.toISOString(),
  })
}

export async function deleteMessage(
  repository: MessageRepository,
  actor: MessageActor,
  messageId: number,
  now = new Date(),
) {
  const current = await repository.getById(messageId)
  if (!current) throw new Error('MESSAGE_NOT_FOUND')
  if (current.deletedAt) throw new Error('MESSAGE_DELETED')

  const ownsMessage = current.senderId === actor.userId
  const adminCanModerateChannel = actor.isAdmin && current.channelId !== null
  if (!ownsMessage && !adminCanModerateChannel) throw new Error('MESSAGE_DELETE_FORBIDDEN')

  return repository.update(messageId, {
    body: null,
    deletedAt: now.toISOString(),
  })
}

export async function loadChannelMessages(
  repository: MessageRepository,
  channelId: string,
  beforeId: number | null = null,
) {
  return repository.listChannel({ channelId, beforeId, limit: 50 })
}

export async function loadDmMessages(
  repository: MessageRepository,
  dmThreadId: string,
  beforeId: number | null = null,
) {
  return repository.listDm({ dmThreadId, beforeId, limit: 50 })
}

function normalizeReactionEmoji(emoji: string) {
  const normalized = emoji.trim()
  if (!normalized || normalized.length > 32) throw new Error('REACTION_EMOJI_INVALID')
  return normalized
}

export async function toggleReaction(
  repository: MessageStateRepository,
  actor: MessageActor,
  messageId: number,
  emoji: string,
) {
  const normalizedEmoji = normalizeReactionEmoji(emoji)
  const exists = await repository.hasReaction(messageId, actor.userId, normalizedEmoji)

  if (exists) {
    await repository.removeReaction(messageId, actor.userId, normalizedEmoji)
    return false
  }

  await repository.addReaction(messageId, actor.userId, normalizedEmoji)
  return true
}

export async function togglePin(
  repository: MessageStateRepository,
  actor: MessageActor,
  messageId: number,
) {
  const existing = await repository.getPin(messageId)
  if (existing) {
    await repository.removePin(messageId)
    return false
  }

  await repository.addPin(messageId, actor.userId)
  return true
}

function assertReadStateTarget(target: ReadStateTarget) {
  const targetCount = Number(target.channelId !== null) + Number(target.dmThreadId !== null)
  if (targetCount !== 1) throw new Error('READ_STATE_TARGET_INVALID')
}

export async function markRoomRead(
  repository: MessageStateRepository,
  actor: MessageActor,
  target: ReadStateTarget,
  lastReadMessageId: number | null,
) {
  assertReadStateTarget(target)
  if (lastReadMessageId !== null && (!Number.isInteger(lastReadMessageId) || lastReadMessageId < 1)) {
    throw new Error('READ_STATE_MESSAGE_INVALID')
  }

  await repository.setReadState({
    userId: actor.userId,
    channelId: target.channelId,
    dmThreadId: target.dmThreadId,
    lastReadMessageId,
  })
}

export function getUnreadCounts(
  messages: UnreadMessage[],
  readStates: UnreadReadState[],
  currentUserId: string,
) {
  const channels: Record<string, number> = {}
  const directMessages: Record<string, number> = {}
  const channelMarkers = new Map<string, number>()
  const dmMarkers = new Map<string, number>()

  for (const state of readStates) {
    if (state.channelId) {
      channelMarkers.set(state.channelId, state.lastReadMessageId ?? 0)
      channels[state.channelId] ??= 0
    }
    if (state.dmThreadId) {
      dmMarkers.set(state.dmThreadId, state.lastReadMessageId ?? 0)
      directMessages[state.dmThreadId] ??= 0
    }
  }

  for (const message of messages) {
    if (message.channelId) channels[message.channelId] ??= 0
    if (message.dmThreadId) directMessages[message.dmThreadId] ??= 0

    if (message.deletedAt || message.senderId === currentUserId) continue

    if (message.channelId && message.id > (channelMarkers.get(message.channelId) ?? 0)) {
      channels[message.channelId] += 1
    }
    if (message.dmThreadId && message.id > (dmMarkers.get(message.dmThreadId) ?? 0)) {
      directMessages[message.dmThreadId] += 1
    }
  }

  return { channels, directMessages }
}
