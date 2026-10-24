'use server'

import { revalidatePath } from 'next/cache'

import { requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { normalizeTheme } from '@/lib/settings/theme'
import { createClient } from '@/lib/supabase/server'

export async function updateDisplayNameAction(formData: FormData) {
  const displayName = String(formData.get('displayName') ?? '').trim()
  if (displayName.length < 1 || displayName.length > 40) throw new Error('DISPLAY_NAME_INVALID')

  const client = await createClient()
  const { claims } = await requireActiveUser(createAuthGuardAccess(client))
  const { error } = await client
    .from('profiles')
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq('user_id', claims.sub)
  if (error) throw error

  revalidatePath('/settings')
  revalidatePath('/', 'layout')
}

export async function updateThemeAction(formData: FormData) {
  const theme = normalizeTheme(formData.get('theme'))
  const client = await createClient()
  const { claims } = await requireActiveUser(createAuthGuardAccess(client))
  const updatedAt = new Date().toISOString()

  const { data: existing, error: updateError } = await client
    .from('user_settings')
    .update({ theme, updated_at: updatedAt })
    .eq('user_id', claims.sub)
    .select('user_id')
    .maybeSingle()

  if (updateError) throw updateError

  if (!existing) {
    const { error: insertError } = await client.from('user_settings').insert({
      user_id: claims.sub,
      theme,
      updated_at: updatedAt,
    })

    if (insertError) throw insertError
  }

  revalidatePath('/settings')
}