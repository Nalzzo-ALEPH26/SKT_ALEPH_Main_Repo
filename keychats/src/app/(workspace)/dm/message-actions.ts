'use server'

import { requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import {
  deleteMessage,
  editMessage,
  loadDmMessages,
  sendDmMessage,
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

export async function sendDmMessageAction(input: { dmThreadId: string; body: string; replyToId: number | null; attachmentCount?: number }) {
  const { actor, repository } = await getMessageContext()
  return sendDmMessage(repository, actor, input)
}

export async function editDmMessageAction(input: { dmThreadId: string; messageId: number; body: string }) {
  const { actor, repository } = await getMessageContext()
  const message = await repository.getById(input.messageId)
  if (!message || message.dmThreadId !== input.dmThreadId) throw new Error('MESSAGE_ROOM_MISMATCH')
  return editMessage(repository, actor, input.messageId, input.body)
}

export async function deleteDmMessageAction(input: { dmThreadId: string; messageId: number }) {
  const { actor, repository } = await getMessageContext()
  const message = await repository.getById(input.messageId)
  if (!message || message.dmThreadId !== input.dmThreadId) throw new Error('MESSAGE_ROOM_MISMATCH')
  return deleteMessage(repository, actor, input.messageId)
}

export async function loadOlderDmMessagesAction(input: { dmThreadId: string; beforeId: number }) {
  const { repository } = await getMessageContext()
  return loadDmMessages(repository, input.dmThreadId, input.beforeId)
}

export async function loadLatestDmMessagesAction(input: { dmThreadId: string }) {
  const { repository } = await getMessageContext()
  return loadDmMessages(repository, input.dmThreadId)
}
