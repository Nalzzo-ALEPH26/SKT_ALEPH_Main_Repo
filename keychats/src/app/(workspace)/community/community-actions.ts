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

function selectedCommunityIds(formData: FormData) {
  return formData
    .getAll('communityIds')
    .map((value) => String(value).trim())
    .filter(Boolean)
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
  const communityIds = selectedCommunityIds(formData)
  if (communityIds.length === 0) throw new Error('COMMUNITY_IDS_REQUIRED')

  const operation = String(formData.get('operation') ?? 'delete').trim()
  if (operation !== 'delete' && operation !== 'pin' && operation !== 'unpin') {
    throw new Error('COMMUNITY_MANAGEMENT_OPERATION_INVALID')
  }

  const client = await createClient()
  const { claims } = await requireActiveUser(createAuthGuardAccess(client))
  if (claims.app_metadata?.role !== 'admin') {
    throw new AuthGuardError('ADMIN_REQUIRED')
  }

  if (operation === 'delete') {
    const { error } = await client.from('communities').delete().in('id', communityIds)
    if (error) throw error
  } else {
    const { error: deleteError } = await client
      .from('community_pins')
      .delete()
      .in('community_id', communityIds)
    if (deleteError) throw deleteError

    if (operation === 'pin') {
      const { error: insertError } = await client.from('community_pins').insert(
        communityIds.map((communityId) => ({
          community_id: communityId,
          pinned_by: claims.sub,
        })),
      )
      if (insertError) throw insertError
    }
  }

  revalidatePath('/')
  revalidatePath('/', 'layout')
}
