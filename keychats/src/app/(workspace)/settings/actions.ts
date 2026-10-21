'use server'

import { revalidatePath } from 'next/cache'

import { requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { normalizeTheme } from '@/lib/settings/theme'
import { createClient } from '@/lib/supabase/server'

export async function updateThemeAction(formData: FormData) {
  const theme = normalizeTheme(formData.get('theme'))
  const client = await createClient()
  const { claims } = await requireActiveUser(createAuthGuardAccess(client))

  const { error } = await client
    .from('user_settings')
    .upsert(
      {
        user_id: claims.sub,
        theme,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (error) throw error
  revalidatePath('/settings')
}
