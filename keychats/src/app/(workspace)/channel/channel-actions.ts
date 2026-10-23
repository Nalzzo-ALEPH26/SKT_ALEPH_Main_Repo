'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import {
  addChannelMember,
  createChannel,
  deleteChannel,
  joinChannelByCode,
  leaveChannel,
  removeChannelMember,
  type ChannelActor,
} from '@/lib/channels/service'
import { createSupabaseChannelRepository } from '@/lib/channels/supabase'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function channelContext() {
  const client = await createClient()
  const { claims, profile } = await requireActiveUser(createAuthGuardAccess(client))
  const actor: ChannelActor = {
    userId: profile.user_id,
    isAdmin: claims.app_metadata?.role === 'admin',
  }

  return {
    actor,
    repository: createSupabaseChannelRepository(createAdminClient()),
  }
}

function requiredText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim()
  if (!value) throw new Error(`${key.toUpperCase()}_REQUIRED`)
  return value
}

export async function createChannelAction(formData: FormData) {
  const { actor, repository } = await channelContext()
  const name = requiredText(formData, 'name')
  const memberIds = formData
    .getAll('memberIds')
    .map((value) => String(value))
    .filter(Boolean)

  const created = await createChannel(repository, actor, name, memberIds)
  revalidatePath('/')
  return { channelId: created.id }
}

export async function joinChannelByCodeAction(formData: FormData) {
  const { actor, repository } = await channelContext()
  const joinCode = requiredText(formData, 'joinCode')
  const channel = await joinChannelByCode(repository, actor, joinCode)
  revalidatePath('/')
  redirect(`/channel/${channel.id}`)
}

export async function leaveChannelAction(formData: FormData) {
  const { actor, repository } = await channelContext()
  const channelId = requiredText(formData, 'channelId')
  await leaveChannel(repository, actor, channelId)
  revalidatePath('/')
  redirect('/settings')
}

export async function manageChannelsAction(formData: FormData) {
  const channelIds = [...new Set(
    formData.getAll('channelIds').map((value) => String(value).trim()).filter(Boolean),
  )]
  if (channelIds.length === 0) return

  const operation = requiredText(formData, 'operation')
  const { actor, repository } = await channelContext()
  if (operation === 'leave') {
    for (const channelId of channelIds) await leaveChannel(repository, actor, channelId)
  } else if (operation === 'delete') {
    for (const channelId of channelIds) await deleteChannel(repository, actor, channelId)
  } else {
    throw new Error('CHANNEL_OPERATION_INVALID')
  }

  revalidatePath('/')
  redirect('/settings')
}

export async function addChannelMemberAction(formData: FormData) {
  const { actor, repository } = await channelContext()
  const channelId = requiredText(formData, 'channelId')
  const userId = requiredText(formData, 'addUserId')

  await addChannelMember(repository, actor, channelId, userId)
  revalidatePath(`/channel/${channelId}`)
  revalidatePath('/')
}

export async function removeChannelMemberAction(formData: FormData) {
  const { actor, repository } = await channelContext()
  const channelId = requiredText(formData, 'channelId')
  const userId = requiredText(formData, 'removeUserId')

  await removeChannelMember(repository, actor, channelId, userId)
  revalidatePath(`/channel/${channelId}`)
  revalidatePath('/')
}

export async function deleteChannelAction(formData: FormData) {
  const { actor, repository } = await channelContext()
  const channelId = requiredText(formData, 'channelId')

  await deleteChannel(repository, actor, channelId)
  revalidatePath('/')
  redirect('/settings')
}
