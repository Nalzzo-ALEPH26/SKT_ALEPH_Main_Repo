import { notFound } from 'next/navigation'

import { ChannelDialog } from '@/components/channel-dialog'
import { ChannelMessagePane } from '@/components/channel-message-pane'
import { MemberDialog } from '@/components/member-dialog'
import { requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { messageRecordToRealtimeRow } from '@/lib/messages/presentation'
import { loadChannelMessages } from '@/lib/messages/service'
import { createSupabaseMessageRepository } from '@/lib/messages/supabase'
import { createClient } from '@/lib/supabase/server'
import {
  addChannelMemberAction,
  createChannelAction,
  deleteChannelAction,
  removeChannelMemberAction,
} from '../channel-actions'

type PageProps = {
  params: Promise<{ channelId: string }>
}

type ProfileOption = {
  userId: string
  displayName: string
  username: string
  avatarPath: string | null
}

export default async function ChannelPage({ params }: PageProps) {
  const { channelId } = await params
  const client = await createClient()
  const { claims, profile } = await requireActiveUser(createAuthGuardAccess(client))

  const { data: channel, error: channelError } = await client
    .from('channels')
    .select('id,name,created_by,is_default')
    .eq('id', channelId)
    .maybeSingle()

  if (channelError) throw channelError
  if (!channel) notFound()

  const { data: memberships, error: membershipError } = await client
    .from('channel_members')
    .select('user_id,role')
    .eq('channel_id', channelId)

  if (membershipError) throw membershipError

  const memberIds = (memberships ?? []).map((membership) => membership.user_id as string)
  const { data: profiles, error: profilesError } = await client
    .from('profiles')
    .select('user_id,username,display_name,avatar_path')
    .eq('status', 'active')
    .order('display_name')

  if (profilesError) throw profilesError

  const allProfiles: ProfileOption[] = (profiles ?? []).map((item) => ({
    userId: item.user_id as string,
    username: item.username as string,
    displayName: item.display_name as string,
    avatarPath: (item.avatar_path as string | null) ?? null,
  }))
  const memberSet = new Set(memberIds)
  const members = allProfiles.filter((item) => memberSet.has(item.userId))
  const candidates = allProfiles.filter((item) => !memberSet.has(item.userId))
  const isAdmin = claims.app_metadata?.role === 'admin'
  const canManage = isAdmin || channel.created_by === profile.user_id
  const initialMessages = await loadChannelMessages(
    createSupabaseMessageRepository(client),
    channelId,
  )

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-8 md:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-black/10 pb-5 dark:border-white/10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">CHANNEL</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">#{channel.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">멤버 {members.length}명</p>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-2 sm:w-auto">
          <ChannelDialog
            profiles={allProfiles}
            currentUserId={profile.user_id}
            action={createChannelAction}
          />
          <MemberDialog
            channelId={channel.id}
            members={members}
            candidates={candidates}
            canManage={canManage}
            canDelete={isAdmin}
            isDefault={Boolean(channel.is_default)}
            addAction={addChannelMemberAction}
            removeAction={removeChannelMemberAction}
            deleteAction={deleteChannelAction}
          />
        </div>
      </header>

      <ChannelMessagePane
        channelId={channelId}
        initialMessages={initialMessages.map(messageRecordToRealtimeRow)}
        profiles={allProfiles}
        currentUserId={profile.user_id}
        isAdmin={isAdmin}
      />
    </div>
  )
}
