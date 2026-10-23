'use server'

import { revalidatePath } from 'next/cache'

import { requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { createClient } from '@/lib/supabase/server'

function communityPath(communityId: string) {
  return `/community/${communityId}`
}

export async function createCommunityPostAction(communityId: string, formData: FormData) {
  const body = String(formData.get('body') ?? '').trim()
  if (body.length < 1 || body.length > 4000) throw new Error('COMMUNITY_POST_BODY_INVALID')

  const client = await createClient()
  const { claims } = await requireActiveUser(createAuthGuardAccess(client))
  const { error } = await client.from('community_posts').insert({
    community_id: communityId,
    author_id: claims.sub,
    body,
  })
  if (error) throw error
  revalidatePath(communityPath(communityId))
}

export async function deleteCommunityPostAction(communityId: string, formData: FormData) {
  const postId = String(formData.get('postId') ?? '').trim()
  if (!postId) throw new Error('COMMUNITY_POST_ID_REQUIRED')

  const client = await createClient()
  await requireActiveUser(createAuthGuardAccess(client))
  const { error } = await client
    .from('community_posts')
    .delete()
    .eq('id', postId)
    .eq('community_id', communityId)
  if (error) throw error
  revalidatePath(communityPath(communityId))
}
