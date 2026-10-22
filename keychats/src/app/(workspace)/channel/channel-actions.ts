'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import {
  addChannelMember,
  createChannel,
  deleteChannel,
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