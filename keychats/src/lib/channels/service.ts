export type ChannelActor = {
  userId: string
  isAdmin: boolean
}

export type ChannelRecord = {
  id: string
  name: string
  createdBy: string
  isDefault: boolean
  joinCode: string
}

export type ChannelRepository = {
  findByNormalizedName: (name: string) => Promise<ChannelRecord | null>
  findByJoinCode: (joinCode: string) => Promise<ChannelRecord | null>
  getById: (channelId: string) => Promise<ChannelRecord | null>
  activeUserIds: (userIds: string[]) => Promise<string[]>
  create: (input: { name: string; createdBy: string }) => Promise<{ id: string }>
  addMember: (channelId: string, userId: string, role: 'owner' | 'member') => Promise<void>
  removeMember: (channelId: string, userId: string) => Promise<void>
  memberCount: (channelId: string) => Promise<number>
  delete: (channelId: string) => Promise<void>
}

function canonicalChannelName(name: string) {
  return name.trim().toLocaleLowerCase('en-US')
}

export function normalizeChannelName(raw: string): string {
  const name = raw.trim()
  if (name.length < 1 || name.length > 80) throw new Error('CHANNEL_NAME_INVALID')
  if (canonicalChannelName(name) === 'general') throw new Error('CHANNEL_NAME_RESERVED')
  return name
}

export function normalizeJoinCode(raw: string) {
  const code = raw.trim()
  if (!/^\d{6}$/.test(code)) throw new Error('CHANNEL_JOIN_CODE_INVALID')
  return code
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids)]
}

function assertCanManage(channel: ChannelRecord, actor: ChannelActor) {
  if (!actor.isAdmin && channel.createdBy !== actor.userId) {
    throw new Error('CHANNEL_MANAGE_FORBIDDEN')
  }
}

async function requireChannel(repository: ChannelRepository, channelId: string) {
  const channel = await repository.getById(channelId)
  if (!channel) throw new Error('CHANNEL_NOT_FOUND')
  return channel
}

export async function createChannel(
  repository: ChannelRepository,
  actor: ChannelActor,
  rawName: string,
  requestedMemberIds: string[],
) {
  const name = normalizeChannelName(rawName)
  const duplicate = await repository.findByNormalizedName(canonicalChannelName(name))
  if (duplicate) throw new Error('CHANNEL_NAME_TAKEN')

  const memberIds = uniqueIds(requestedMemberIds).filter((id) => id !== actor.userId)
  if (memberIds.length > 0) {
    const activeIds = new Set(await repository.activeUserIds(memberIds))
    if (memberIds.some((id) => !activeIds.has(id))) throw new Error('CHANNEL_MEMBER_INVALID')
  }

  const created = await repository.create({ name, createdBy: actor.userId })
  try {
    await repository.addMember(created.id, actor.userId, 'owner')
    for (const memberId of memberIds) await repository.addMember(created.id, memberId, 'member')
  } catch (error) {
    await repository.delete(created.id).catch(() => undefined)
    throw error
  }
  return created
}

export async function joinChannelByCode(
  repository: ChannelRepository,
  actor: ChannelActor,
  rawCode: string,
) {
  const code = normalizeJoinCode(rawCode)
  const channel = await repository.findByJoinCode(code)
  if (!channel) throw new Error('CHANNEL_JOIN_CODE_NOT_FOUND')
  await repository.addMember(
    channel.id,
    actor.userId,
    channel.createdBy === actor.userId ? 'owner' : 'member',
  )
  return channel
}

export async function leaveChannel(
  repository: ChannelRepository,
  actor: ChannelActor,
  channelId: string,
) {
  const channel = await requireChannel(repository, channelId)

  if (!channel.isDefault) {
    const memberCount = await repository.memberCount(channelId)
    if (memberCount <= 1) {
      if (!actor.isAdmin && channel.createdBy !== actor.userId) {
        throw new Error('CHANNEL_MANAGE_FORBIDDEN')
      }
      await repository.delete(channelId)
      return
    }
  }

  if (channel.createdBy === actor.userId && !channel.isDefault) {
    throw new Error('CHANNEL_OWNER_REQUIRED')
  }
  await repository.removeMember(channelId, actor.userId)
}

export async function addChannelMember(
  repository: ChannelRepository,
  actor: ChannelActor,
  channelId: string,
  userId: string,
) {
  const channel = await requireChannel(repository, channelId)
  assertCanManage(channel, actor)
  const activeIds = await repository.activeUserIds([userId])
  if (!activeIds.includes(userId)) throw new Error('CHANNEL_MEMBER_INVALID')
  await repository.addMember(channelId, userId, userId === channel.createdBy ? 'owner' : 'member')
}

export async function removeChannelMember(
  repository: ChannelRepository,
  actor: ChannelActor,
  channelId: string,
  userId: string,
) {
  const channel = await requireChannel(repository, channelId)
  assertCanManage(channel, actor)
  if (userId === channel.createdBy) throw new Error('CHANNEL_OWNER_REQUIRED')
  await repository.removeMember(channelId, userId)
}

export async function deleteChannel(
  repository: ChannelRepository,
  actor: ChannelActor,
  channelId: string,
) {
  if (!actor.isAdmin) throw new Error('CHANNEL_DELETE_ADMIN_REQUIRED')
  const channel = await requireChannel(repository, channelId)
  if (channel.isDefault || canonicalChannelName(channel.name) === 'general') {
    throw new Error('DEFAULT_CHANNEL_UNDELETABLE')
  }
  await repository.delete(channelId)
}
