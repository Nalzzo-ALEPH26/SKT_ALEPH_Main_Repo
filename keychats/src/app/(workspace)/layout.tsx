import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { AuthGuardError, requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { buildDirectSidebarData } from '@/lib/dms/presentation'
import { loadUnreadCounts } from '@/lib/messages/state-supabase'
import { normalizeTheme, type KeychatsTheme } from '@/lib/settings/theme'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const client = await createClient()

  let authResult: Awaited<ReturnType<typeof requireActiveUser>>
  try {
    authResult = await requireActiveUser(createAuthGuardAccess(client))
  } catch (error) {
    if (error instanceof AuthGuardError) redirect('/login')
    throw error
  }

  const { profile, claims } = authResult
  const isAdmin = claims.app_metadata?.role === 'admin'

  const [
    { data: settings, error: settingsError },
    { data: channels, error: channelsError },
    { data: channelMemberships, error: membershipsError },
    { data: dmThreads, error: dmThreadsError },
    { data: hiddenDmThreads, error: hiddenDmThreadsError },
    { data: activeProfiles, error: profilesError },
    { data: communities, error: communitiesError },
    { data: communityPins, error: communityPinsError },
    unread,
  ] = await Promise.all([
    client.from('user_settings').select('theme').eq('user_id', profile.user_id).maybeSingle(),
    client.from('channels').select('id,name,created_by,is_default').order('is_default', { ascending: false }).order('name'),
    client.from('channel_members').select('channel_id,user_id'),
    client.from('dm_threads').select('id,user_low,user_high').order('created_at', { ascending: false }),
    client.from('dm_hidden_threads').select('dm_thread_id').eq('user_id', profile.user_id),
    client.from('profiles').select('user_id,display_name,username').eq('status', 'active').order('display_name'),
    client.from('communities').select('id,name,created_at,is_notice').order('created_at', { ascending: true }),
    client.from('community_pins').select('community_id,pinned_at').order('pinned_at', { ascending: false }),
    loadUnreadCounts(client),
  ])

  if (settingsError) throw settingsError
  if (channelsError) throw channelsError
  if (membershipsError) throw membershipsError
  if (dmThreadsError) throw dmThreadsError
  if (hiddenDmThreadsError) throw hiddenDmThreadsError
  if (profilesError) throw profilesError
  if (communitiesError) throw communitiesError
  if (communityPinsError) throw communityPinsError

  let theme: KeychatsTheme = 'light'
  if (settings?.theme) theme = normalizeTheme(settings.theme)

  const directProfiles = (activeProfiles ?? []).map((candidate) => ({ userId: candidate.user_id as string, displayName: candidate.display_name as string }))
  const hiddenThreadIds = new Set((hiddenDmThreads ?? []).map((row) => row.dm_thread_id as string))
  const direct = buildDirectSidebarData(profile.user_id, directProfiles, (dmThreads ?? []).map((thread) => ({ id: thread.id as string, userLow: thread.user_low as string, userHigh: thread.user_high as string })), hiddenThreadIds)

  const memberChannelIds = new Set((channelMemberships ?? []).filter((membership) => membership.user_id === profile.user_id).map((membership) => membership.channel_id as string))
  const channelMemberCounts = new Map<string, number>()
  for (const membership of channelMemberships ?? []) {
    const channelId = membership.channel_id as string
    channelMemberCounts.set(channelId, (channelMemberCounts.get(channelId) ?? 0) + 1)
  }

  const communityPinTime = new Map((communityPins ?? []).map((pin) => [pin.community_id as string, new Date(pin.pinned_at as string).getTime()]))
  const communityPinValue = new Map((communityPins ?? []).map((pin) => [pin.community_id as string, pin.pinned_at as string]))
  const sortedCommunities = [...(communities ?? [])].sort((left, right) => {
    if (Boolean(left.is_notice) !== Boolean(right.is_notice)) return left.is_notice ? -1 : 1
    const leftPin = communityPinTime.get(left.id as string)
    const rightPin = communityPinTime.get(right.id as string)
    if (leftPin && rightPin) return rightPin - leftPin
    if (leftPin) return -1
    if (rightPin) return 1
    return new Date(left.created_at as string).getTime() - new Date(right.created_at as string).getTime()
  })

  return (
    <AppShell
      profile={{ displayName: profile.display_name, avatarPath: profile.avatar_path }}
      currentUserId={profile.user_id}
      channelProfiles={(activeProfiles ?? []).map((candidate) => ({ userId: candidate.user_id as string, displayName: candidate.display_name as string, username: candidate.username as string }))}
      channels={(channels ?? []).map((channel) => {
        const id = channel.id as string
        const name = channel.name as string
        const isDefault = Boolean(channel.is_default)
        const createdBy = channel.created_by as string
        const isMember = memberChannelIds.has(id)
        const memberCount = channelMemberCounts.get(id) ?? 0
        return {
          id,
          name,
          unreadCount: unread.channels[id] ?? 0,
          canLeave: isMember && (createdBy !== profile.user_id || isDefault || memberCount <= 1),
          canDelete: isAdmin && !isDefault && name.trim().toLowerCase() !== 'general',
        }
      })}
      directMessages={direct.directMessages.map((directMessage) => ({ ...directMessage, unreadCount: unread.directMessages[directMessage.id] ?? 0 }))}
      directCandidates={direct.directCandidates}
      communities={sortedCommunities.map((community) => ({
        id: community.id as string,
        name: community.name as string,
        pinnedAt: communityPinValue.get(community.id as string) ?? null,
        isNotice: Boolean(community.is_notice),
      }))}
      theme={theme}
      isAdmin={isAdmin}
    >
      {children}
    </AppShell>
  )
}
