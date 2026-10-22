'use server'

import { requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import {
  deleteMessage,
  editMessage,
  loadChannelMessages,
  sendChannelMessage,
  type MessageActor,
} from '@/lib/messages/service'
import { createSupabaseMessageRepository } from '@/lib/messages/supabase'
import { createClient } from '@/lib/supabase/server'

async function getMessageContext() {
  const client = await createClient()
  const { claims } = await requireActiveUser(createAuthGuardAccess(client))
  const actor: MessageActor = {
    userId: claims.sub,
    isAdmin: claims.app_metadata?.role === 'admin',
  }
  return { actor, repository: createSupabaseMessageRepository(client) }
}

export async function sendChannelMessageAction(input: { channelId: string; body: string; replyToId: number | null; attachmentCount?: number }) {
  const { actor, repository } = await getMessageContext()
  return sendChannelMessage(repository, actor, input)
}

export async function editChannelMessageAction(input: { channelId: string; messageId: number; body: string }) {
  const { actor, repository } = await getMessageContext()
  const message = await repository.getById(input.messageId)
  if (!message || message.channelId !== input.channelId) throw new Error('MESSAGE_ROOM_MISMATCH')
  return editMessage(repository, actor, input.messageId, input.body)
}

export async function deleteChannelMessageAction(input: { channelId: string; messageId: number }) {
  const { actor, repository } = await getMessageContext()
  const message = await repository.getById(input.messageId)
  if (!message || message.channelId !== input.channelId) throw new Error('MESSAGE_ROOM_MISMATCH')
  return deleteMessage(repository, actor, input.messageId)
}

export async function loadOlderChannelMessagesAction(input: { channelId: string; beforeId: number }) {
  const { repository } = await getMessageContext()
  return loadChannelMessages(repository, input.channelId, input.beforeId)
}

export async function loadLatestChannelMessagesAction(input: { channelId: string }) {
  const { repository } = await getMessageContext()
  return loadChannelMessages(repository, input.channelId)
}
