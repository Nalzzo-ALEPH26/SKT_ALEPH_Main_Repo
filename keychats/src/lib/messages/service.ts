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
}

type SendChannelMessageInput = {
  channelId: string
  body?: string | null
  replyToId?: number | null
  attachmentCount?: number
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

export async function sendChannelMessage(
  repository: MessageRepository,
  actor: MessageActor,
  input: SendChannelMessageInput,
) {
  const body = normalizedBody(input.body)
  const attachmentCount = assertValidAttachmentCount(input.attachmentCount)
  if (!body && attachmentCount === 0) throw new Error('MESSAGE_EMPTY')

  const replyToId = input.replyToId ?? null
  if (replyToId !== null) {
    const parent = await repository.getById(replyToId)
    if (!parent || parent.deletedAt) throw new Error('MESSAGE_REPLY_INVALID')
    if (parent.channelId !== input.channelId || parent.dmThreadId !== null) {
      throw new Error('MESSAGE_REPLY_ROOM_MISMATCH')
    }
  }

  return repository.create({
    channelId: input.channelId,
    dmThreadId: null,
    senderId: actor.userId,
    body,
    replyToId,
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
