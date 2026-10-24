'use server'

import { requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import {
  markRoomRead,
  togglePin,
  toggleReaction,
  type MessageActor,
  type ReadStateTarget,
} from '@/lib/messages/service'
import {
  createSupabaseMessageStateRepository,
  loadMessageStateSnapshot,
} from '@/lib/messages/state-supabase'
import { createClient } from '@/lib/supabase/server'

async function getMessageStateContext() {
  const client = await createClient()
  const { claims } = await requireActiveUser(createAuthGuardAccess(client))
  const actor: MessageActor = {
    userId: claims.sub,
    isAdmin: claims.app_metadata?.role === 'admin',
  }

  return {
    client,
    actor,
    repository: createSupabaseMessageStateRepository(client),
  }
}

export async function toggleMessageReactionAction(input: {
  messageId: number
  emoji: string
}) {
  const { actor, repository } = await getMessageStateContext()
  const active = await toggleReaction(repository, actor, input.messageId, input.emoji)
  return { active }
}

export async function toggleMessagePinAction(input: { messageId: number }) {
  const { actor, repository } = await getMessageStateContext()
  const pinned = await togglePin(repository, actor, input.messageId)
  return { pinned }
}

export async function markConversationReadAction(
  input: ReadStateTarget & { lastReadMessageId: number | null },
) {
  const { actor, repository } = await getMessageStateContext()
  await markRoomRead(
    repository,
    actor,
    { channelId: input.channelId, dmThreadId: input.dmThreadId },
    input.lastReadMessageId,
  )
}

export async function loadMessageStateAction(input: { messageIds: number[] }) {
  const { client, actor } = await getMessageStateContext()
  return loadMessageStateSnapshot(client, input.messageIds, actor.userId)
}
