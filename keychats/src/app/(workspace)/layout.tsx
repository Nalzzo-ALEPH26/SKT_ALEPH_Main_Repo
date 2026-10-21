import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { AuthGuardError, requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { buildDirectSidebarData } from '@/lib/dms/presentation'
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

  const [
    { data: settings, error: settingsError },
    { data: channels, error: channelsError },
    { data: dmThreads, error: dmThreadsError },
    { data: activeProfiles, error: profilesError },
  ] = await Promise.all([
    client
      .from('user_settings')
      .select('theme')
      .eq('user_id', profile.user_id)
      .maybeSingle(),
    client.from('channels').select('id,name').order('is_default', { ascending: false }).order('name'),
    client.from('dm_threads').select('id,user_low,user_high').order('created_at', { ascending: false }),
    client
      .from('profiles')
      .select('user_id,display_name')
      .eq('status', 'active')
      .order('display_name'),
  ])

  if (settingsError) throw settingsError
  if (channelsError) throw channelsError
  if (dmThreadsError) throw dmThreadsError
  if (profilesError) throw profilesError

  let theme: KeychatsTheme = 'light'
  if (settings?.theme) {
    theme = normalizeTheme(settings.theme)
  }

  const direct = buildDirectSidebarData(
    profile.user_id,
    (activeProfiles ?? []).map((candidate) => ({
      userId: candidate.user_id as string,
      displayName: candidate.display_name as string,
    })),
    (dmThreads ?? []).map((thread) => ({
      id: thread.id as string,
      userLow: thread.user_low as string,
      userHigh: thread.user_high as string,
    })),
  )

  return (
    <AppShell
      profile={{ displayName: profile.display_name, avatarPath: profile.avatar_path }}
      channels={(channels ?? []).map((channel) => ({
        id: channel.id as string,
        name: channel.name as string,
        unreadCount: 0,
      }))}
      directMessages={direct.directMessages}
      directCandidates={direct.directCandidates}
      theme={theme}
    >
      {children}
    </AppShell>
  )
}
