import { notFound } from 'next/navigation'

import { DmMessagePane } from '@/components/dm-message-pane'
import { requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { counterpartUserId } from '@/lib/dms/presentation'
import { messageRecordToRealtimeRow } from '@/lib/messages/presentation'
import { loadDmMessages } from '@/lib/messages/service'
import { createSupabaseMessageRepository } from '@/lib/messages/supabase'
import { createClient } from '@/lib/supabase/server'

type PageProps = {
  params: Promise<{ threadId: string }>
}

type ProfileOption = {
  userId: string
  displayName: string
  username: string
  avatarPath: string | null
}

export default async function DmPage({ params }: PageProps) {
  const { threadId } = await params
  const client = await createClient()
  const { claims, profile } = await requireActiveUser(createAuthGuardAccess(client))

  const { data: thread, error: threadError } = await client
    .from('dm_threads')
    .select('id,user_low,user_high')
    .eq('id', threadId)
    .maybeSingle()

  if (threadError) throw threadError
  if (!thread) notFound()

  const otherUserId = counterpartUserId(
    { userLow: thread.user_low as string, userHigh: thread.user_high as string },
    profile.user_id,
  )

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
  const counterpart = allProfiles.find((item) => item.userId === otherUserId)
  const initialMessages = await loadDmMessages(createSupabaseMessageRepository(client), threadId)

  return (
    <div className="mx-auto flex h-dvh w-full max-w-5xl flex-col overflow-hidden px-5 py-5 md:px-8">
      <header className="shrink-0 border-b border-black/10 pb-4 dark:border-white/10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">DIRECT MESSAGE</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {counterpart?.displayName ?? '알 수 없는 사용자'}
        </h1>
      </header>

      <DmMessagePane
        dmThreadId={threadId}
        initialMessages={initialMessages.map(messageRecordToRealtimeRow)}
        profiles={allProfiles}
        currentUserId={profile.user_id}
        isAdmin={claims.app_metadata?.role === 'admin'}
      />
    </div>
  )
}
