'use server'

import { revalidatePath } from 'next/cache'

import { requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { createClient } from '@/lib/supabase/server'

export async function createFeedbackAction(formData: FormData) {
  const body = String(formData.get('body') ?? '').trim()
  if (body.length < 1 || body.length > 4000) throw new Error('FEEDBACK_BODY_INVALID')

  const client = await createClient()
  const { claims } = await requireActiveUser(createAuthGuardAccess(client))
  const { error } = await client.from('feedback_posts').insert({
    author_id: claims.sub,
    body,
  })
  if (error) throw error
  revalidatePath('/feedback')
}

export async function deleteFeedbackAction(formData: FormData) {
  const id = String(formData.get('feedbackId') ?? '')
  if (!id) throw new Error('FEEDBACK_ID_REQUIRED')

  const client = await createClient()
  await requireActiveUser(createAuthGuardAccess(client))
  const { error } = await client.from('feedback_posts').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/feedback')
}
