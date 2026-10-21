import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { AuthGuardError, requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { normalizeTheme, type KeychatsTheme } from '@/lib/settings/theme'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const client = await createClient()

  let profile: Awaited<ReturnType<typeof requireActiveUser>>['profile']
  try {
    ;({ profile } = await requireActiveUser(createAuthGuardAccess(client)))
  } catch (error) {
    if (error instanceof AuthGuardError) redirect('/login')
    throw error
  }

  const { data: settings, error: settingsError } = await client
    .from('user_settings')
    .select('theme')
    .eq('user_id', profile.user_id)
    .maybeSingle()

  if (settingsError) throw settingsError

  let theme: KeychatsTheme = 'light'
  if (settings?.theme) {
    theme = normalizeTheme(settings.theme)
  }

  return (
    <AppShell
      profile={{ displayName: profile.display_name, avatarPath: profile.avatar_path }}
      channels={[]}
      directMessages={[]}
      theme={theme}
    >
      {children}
    </AppShell>
  )
}
