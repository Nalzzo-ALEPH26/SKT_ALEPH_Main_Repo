'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { getOrCreateDm, hideDirectMessages } from '@/lib/dms/service'
import { createSupabaseDmRepository } from '@/lib/dms/supabase'
import { createClient } from '@/lib/supabase/server'

function requiredText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim()
  if (!value) throw new Error(`${key.replace(/([A-Z])/g, '_$1').toUpperCase()}_REQUIRED`)
  return value
}

async function dmContext() {
  const client = await createClient()
  const { profile } = await requireActiveUser(createAuthGuardAccess(client))
  return {
    profile,
    repository: createSupabaseDmRepository(client),
  }
}

export async function startDirectMessageAction(formData: FormData) {
  const otherUserId = requiredText(formData, 'otherUserId')
  const { profile, repository } = await dmContext()
  const thread = await getOrCreateDm(repository, profile.user_id, otherUserId)

  revalidatePath('/', 'layout')
  redirect(`/dm/${thread.id}`)
}

export async function manageDirectMessagesAction(formData: FormData) {
  const threadIds = formData
    .getAll('dmThreadIds')
    .map((value) => String(value).trim())
    .filter(Boolean)

  if (threadIds.length === 0) return

  const { profile, repository } = await dmContext()
  await hideDirectMessages(repository, profile.user_id, threadIds)
  revalidatePath('/')
  redirect('/settings')
}
