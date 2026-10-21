'use server'

import { redirect } from 'next/navigation'

import { requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { getOrCreateDm } from '@/lib/dms/service'
import { createSupabaseDmRepository } from '@/lib/dms/supabase'
import { createClient } from '@/lib/supabase/server'

function requiredText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim()
  if (!value) throw new Error(`${key.replace(/([A-Z])/g, '_$1').toUpperCase()}_REQUIRED`)
  return value
}

export async function startDirectMessageAction(formData: FormData) {
  const otherUserId = requiredText(formData, 'otherUserId')
  const client = await createClient()
  const { profile } = await requireActiveUser(createAuthGuardAccess(client))
  const thread = await getOrCreateDm(
    createSupabaseDmRepository(client),
    profile.user_id,
    otherUserId,
  )

  redirect(`/dm/${thread.id}`)
}
