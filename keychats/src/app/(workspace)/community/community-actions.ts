'use server'

import { revalidatePath } from 'next/cache'

import { AuthGuardError, requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { createClient } from '@/lib/supabase/server'

function requiredText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim()
  if (!value) throw new Error(`${key.replace(/([A-Z])/g, '_$1').toUpperCase()}_REQUIRED`)
  return value
}

export async function createCommunityAction(formData: FormData) {
  const name = requiredText(formData, 'communityName')
  if (name.length > 40) throw new Error('COMMUNITY_NAME_INVALID')

  const client = await createClient()
  const { claims } = await requireActiveUser(createAuthGuardAccess(client))
  const { error } = await client.from('communities').insert({
    name,
    created_by: claims.sub,
  })
  if (error) throw error
  revalidatePath('/')
}

export async function deleteCommunitiesAction(formData: FormData) {
  const communityIds = formData
    .getAll('communityIds')
    .map((value) => String(value).trim())
    .filter(Boolean)

  if (communityIds.length === 0) throw new Error('COMMUNITY_IDS_REQUIRED')

  const client = await createClient()
  const { claims } = await requireActiveUser(createAuthGuardAccess(client))
  if (claims.app_metadata?.role !== 'admin') {
    throw new AuthGuardError('ADMIN_REQUIRED')
  }

  const { error } = await client.from('communities').delete().in('id', communityIds)
  if (error) throw error
  revalidatePath('/')
}
