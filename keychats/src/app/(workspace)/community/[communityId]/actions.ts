'use server'

import { revalidatePath } from 'next/cache'

import { AuthGuardError, requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { createClient } from '@/lib/supabase/server'

function communityPath(communityId: string) {
  return `/community/${communityId}`
}

function requiredText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim()
  if (!value) throw new Error(`${key.replace(/([A-Z])/g, '_$1').toUpperCase()}_REQUIRED`)
  return value
}

async function requireAdmin(client: Awaited<ReturnType<typeof createClient>>) {
  const { claims } = await requireActiveUser(createAuthGuardAccess(client))
  if (claims.app_metadata?.role !== 'admin') throw new AuthGuardError('ADMIN_REQUIRED')
  return claims
}

async function requireCommunityModerator(
  client: Awaited<ReturnType<typeof createClient>>,
  communityId: string,
) {
  const { claims } = await requireActiveUser(createAuthGuardAccess(client))
  const { data: community, error } = await client
    .from('communities')
    .select('id,created_by')
    .eq('id', communityId)
    .maybeSingle()
  if (error) throw error
  if (!community) throw new Error('COMMUNITY_NOT_FOUND')
  if (claims.app_metadata?.role !== 'admin' && community.created_by !== claims.sub) {
    throw new Error('COMMUNITY_MODERATION_FORBIDDEN')
  }
  return claims
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
  const postId = requiredText(formData, 'postId')
  const client = await createClient()
  await requireActiveUser(createAuthGuardAccess(client))
  const { error } = await client.from('community_posts').delete().eq('id', postId).eq('community_id', communityId)
  if (error) throw error
  revalidatePath(communityPath(communityId))
}

export async function renameCommunityAction(communityId: string, formData: FormData) {
  const name = requiredText(formData, 'communityName')
  if (name.length > 40) throw new Error('COMMUNITY_NAME_INVALID')

  const client = await createClient()
  const { claims } = await requireActiveUser(createAuthGuardAccess(client))
  const { error } = await client
    .from('communities')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', communityId)
    .eq('created_by', claims.sub)
  if (error) throw error
  revalidatePath(communityPath(communityId))
  revalidatePath('/', 'layout')
}

export async function setCommunityPinnedAction(communityId: string, formData: FormData) {
  const operation = requiredText(formData, 'operation')
  if (operation !== 'pin' && operation !== 'unpin') throw new Error('COMMUNITY_PIN_OPERATION_INVALID')

  const client = await createClient()
  const claims = await requireAdmin(client)
  const { error: deleteError } = await client.from('community_pins').delete().eq('community_id', communityId)
  if (deleteError) throw deleteError
  if (operation === 'pin') {
    const { error } = await client.from('community_pins').insert({ community_id: communityId, pinned_by: claims.sub })
    if (error) throw error
  }
  revalidatePath(communityPath(communityId))
  revalidatePath('/', 'layout')
}

export async function setCommunityPostPinnedAction(communityId: string, formData: FormData) {
  const postId = requiredText(formData, 'postId')
  const operation = requiredText(formData, 'operation')
  if (operation !== 'pin' && operation !== 'unpin') throw new Error('COMMUNITY_POST_PIN_OPERATION_INVALID')

  const client = await createClient()
  const claims = await requireCommunityModerator(client, communityId)
  const { data: post, error: postError } = await client
    .from('community_posts')
    .select('id')
    .eq('id', postId)
    .eq('community_id', communityId)
    .maybeSingle()
  if (postError) throw postError
  if (!post) throw new Error('COMMUNITY_POST_NOT_FOUND')

  const { error: deleteError } = await client.from('community_post_pins').delete().eq('post_id', postId)
  if (deleteError) throw deleteError
  if (operation === 'pin') {
    const { error } = await client.from('community_post_pins').insert({ post_id: postId, pinned_by: claims.sub })
    if (error) throw error
  }
  revalidatePath(communityPath(communityId))
}

export async function createCommunityCommentAction(communityId: string, formData: FormData) {
  const postId = requiredText(formData, 'postId')
  const body = requiredText(formData, 'commentBody')
  if (body.length > 1000) throw new Error('COMMUNITY_COMMENT_BODY_INVALID')

  const client = await createClient()
  const { claims } = await requireActiveUser(createAuthGuardAccess(client))
  const { data: post, error: postError } = await client.from('community_posts').select('id').eq('id', postId).eq('community_id', communityId).maybeSingle()
  if (postError) throw postError
  if (!post) throw new Error('COMMUNITY_POST_NOT_FOUND')

  const { error } = await client.from('community_comments').insert({ post_id: postId, author_id: claims.sub, body })
  if (error) throw error
  revalidatePath(communityPath(communityId))
}

export async function deleteCommunityCommentAction(communityId: string, formData: FormData) {
  const commentId = requiredText(formData, 'commentId')
  const postId = requiredText(formData, 'postId')
  const client = await createClient()
  await requireActiveUser(createAuthGuardAccess(client))
  const { error } = await client.from('community_comments').delete().eq('id', commentId).eq('post_id', postId)
  if (error) throw error
  revalidatePath(communityPath(communityId))
}

export async function setCommunityCommentPinnedAction(communityId: string, formData: FormData) {
  const commentId = requiredText(formData, 'commentId')
  const postId = requiredText(formData, 'postId')
  const operation = requiredText(formData, 'operation')
  if (operation !== 'pin' && operation !== 'unpin') throw new Error('COMMUNITY_COMMENT_PIN_OPERATION_INVALID')

  const client = await createClient()
  const claims = await requireCommunityModerator(client, communityId)
  const { data: post, error: postError } = await client.from('community_posts').select('id').eq('id', postId).eq('community_id', communityId).maybeSingle()
  if (postError) throw postError
  if (!post) throw new Error('COMMUNITY_POST_NOT_FOUND')
  const { data: comment, error: commentError } = await client.from('community_comments').select('id').eq('id', commentId).eq('post_id', postId).maybeSingle()
  if (commentError) throw commentError
  if (!comment) throw new Error('COMMUNITY_COMMENT_NOT_FOUND')

  const { error: deleteError } = await client.from('community_comment_pins').delete().eq('comment_id', commentId)
  if (deleteError) throw deleteError
  if (operation === 'pin') {
    const { error } = await client.from('community_comment_pins').insert({ comment_id: commentId, pinned_by: claims.sub })
    if (error) throw error
  }
  revalidatePath(communityPath(communityId))
}
