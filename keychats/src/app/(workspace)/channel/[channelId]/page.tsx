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
  leaveChannelAction,
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
  const messageRepository = createSupabaseMessageRepository(client)

  const [
    { data: channel, error: channelError },
    { data: memberships, error: membershipError },
    { data: profiles, error: profilesError },
    initialMessages,
  ] = await Promise.all([
    client
      .from('channels')
      .select('id,name,created_by,is_default,join_code')
      .eq('id', channelId)
      .maybeSingle(),
    client
      .from('channel_members')
      .select('user_id,role')
      .eq('channel_id', channelId),
    client
      .from('profiles')
      .select('user_id,username,display_name,avatar_path')
      .eq('status', 'active')
      .order('display_name'),
    loadChannelMessages(messageRepository, channelId),
  ])

  if (channelError) throw channelError
  if (!channel) notFound()
  if (membershipError) throw membershipError
  if (profilesError) throw profilesError

  const memberIds = (memberships ?? []).map((membership) => membership.user_id as string)
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

  return (
    <div className="mx-auto flex h-dvh w-full max-w-5xl flex-col overflow-hidden px-5 py-5 md:px-8">
      <header className="shrink-0 flex flex-wrap items-start justify-between gap-4 border-b border-black/10 pb-4 dark:border-white/10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">CHANNEL</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">#{channel.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-1 text-sm text-zinc-500">
            <span>멤버 {members.length}명</span>
            <span aria-hidden="true">·</span>
            <span>입장 코드 <span className="font-mono">{channel.join_code}</span></span>
          </p>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-2 sm:w-auto">
          <ChannelDialog profiles={allProfiles} currentUserId={profile.user_id} action={createChannelAction} />
          <MemberDialog
            channelId={channel.id}
            members={members}
            candidates={candidates}
            canManage={canManage}
            canDelete={isAdmin}
            canLeave={memberSet.has(profile.user_id)}
            isDefault={Boolean(channel.is_default)}
            addAction={addChannelMemberAction}
            removeAction={removeChannelMemberAction}
            deleteAction={deleteChannelAction}
            leaveAction={leaveChannelAction}
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
