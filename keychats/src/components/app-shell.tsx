'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { Sidebar } from '@/components/sidebar'
import { shouldRefreshForUnknownDmThread } from '@/lib/dms/sidebar-refresh'
import type { RealtimeMessageRow } from '@/lib/messages/realtime'
import type { KeychatsTheme } from '@/lib/settings/theme'
import { createClient } from '@/lib/supabase/client'

type ChannelItem = {
  id: string
  name: string
  unreadCount: number
  canLeave?: boolean
  canDelete?: boolean
}

type DirectItem = {
  id: string
  displayName: string
  unreadCount: number
}

type CommunityItem = {
  id: string
  name: string
}

type AppShellProps = {
  profile: {
    displayName: string
    avatarPath: string | null
  }
  currentUserId?: string
  channelProfiles?: Array<{
    userId: string
    displayName: string
    username: string
  }>
  channels: ChannelItem[]
  directMessages: DirectItem[]
  directCandidates?: Array<{
    userId: string
    displayName: string
  }>
  communities?: CommunityItem[]
  theme?: KeychatsTheme
  isAdmin?: boolean
  children?: ReactNode
}

type UnreadCounts = {
  channels: Record<string, number>
  directMessages: Record<string, number>
}

type ActiveRoom =
  | { kind: 'channel'; id: string }
  | { kind: 'dm'; id: string }
  | null

type UnreadCountRow = {
  room_type: 'channel' | 'dm'
  room_id: string
  unread_count: number | string
}

function activeRoomFromPathname(pathname: string): ActiveRoom {
  const channelMatch = pathname.match(/\/channel\/([^/]+)\/?$/)
  if (channelMatch?.[1]) return { kind: 'channel', id: channelMatch[1] }

  const dmMatch = pathname.match(/\/dm\/([^/]+)\/?$/)
  if (dmMatch?.[1]) return { kind: 'dm', id: dmMatch[1] }

  return null
}

function initialUnreadCounts(channels: ChannelItem[], directMessages: DirectItem[]): UnreadCounts {
  return {
    channels: Object.fromEntries(
      channels.filter((channel) => channel.unreadCount > 0).map((channel) => [channel.id, channel.unreadCount]),
    ),
    directMessages: Object.fromEntries(
      directMessages.filter((direct) => direct.unreadCount > 0).map((direct) => [direct.id, direct.unreadCount]),
    ),
  }
}

function clearActiveRoom(counts: UnreadCounts, activeRoom: ActiveRoom): UnreadCounts {
  if (!activeRoom) return counts

  if (activeRoom.kind === 'channel') {
    if (!counts.channels[activeRoom.id]) return counts
    const channels = { ...counts.channels }
    delete channels[activeRoom.id]
    return { ...counts, channels }
  }

  if (!counts.directMessages[activeRoom.id]) return counts
  const directMessages = { ...counts.directMessages }
  delete directMessages[activeRoom.id]
  return { ...counts, directMessages }
}

function mapUnreadRows(
  rows: UnreadCountRow[],
  knownChannelIds: Set<string>,
  knownDmIds: Set<string>,
  activeRoom: ActiveRoom,
): UnreadCounts {
  const next: UnreadCounts = { channels: {}, directMessages: {} }

  for (const row of rows) {
    const count = Number(row.unread_count)
    if (!Number.isFinite(count) || count <= 0) continue

    if (row.room_type === 'channel' && knownChannelIds.has(row.room_id)) {
      next.channels[row.room_id] = count
    }
    if (row.room_type === 'dm' && knownDmIds.has(row.room_id)) {
      next.directMessages[row.room_id] = count
    }
  }

  return clearActiveRoom(next, activeRoom)
}

export function AppShell({
  profile,
  currentUserId = '',
  channelProfiles = [],
  channels,
  directMessages,
  directCandidates = [],
  communities = [],
  theme = 'light',
  isAdmin = false,
  children,
}: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const dark = theme === 'dark'
  const initialActiveRoom = activeRoomFromPathname(pathname)
  const [unread, setUnread] = useState<UnreadCounts>(() =>
    clearActiveRoom(initialUnreadCounts(channels, directMessages), initialActiveRoom),
  )
  const [unreadRealtimeStatus, setUnreadRealtimeStatus] = useState('connecting')
  const activeRoomRef = useRef<ActiveRoom>(initialActiveRoom)
  const knownChannelIds = useMemo(() => new Set(channels.map((channel) => channel.id)), [channels])
  const knownDmIds = useMemo(() => new Set(directMessages.map((direct) => direct.id)), [directMessages])

  useEffect(() => {
    const activeRoom = activeRoomFromPathname(pathname)
    activeRoomRef.current = activeRoom
    setUnread((current) => clearActiveRoom(current, activeRoom))
  }, [pathname])

  useEffect(() => {
    setUnread(
      clearActiveRoom(
        initialUnreadCounts(channels, directMessages),
        activeRoomRef.current,
      ),
    )
  }, [channels, directMessages])

  useEffect(() => {
    if (!currentUserId) {
      setUnreadRealtimeStatus('auth-missing')
      return
    }

    const client = createClient()
    let active = true
    let realtimeChannel: ReturnType<typeof client.channel> | null = null

    const syncUnread = async () => {
      const { data, error } = await client.rpc('get_unread_counts')
      if (!active || error) return
      setUnread(
        mapUnreadRows(
          (data ?? []) as UnreadCountRow[],
          knownChannelIds,
          knownDmIds,
          activeRoomRef.current,
        ),
      )
    }

    const handleInsert = (message: RealtimeMessageRow) => {
      if (!active || message.deleted_at) return

      if (shouldRefreshForUnknownDmThread(message.dm_thread_id, knownDmIds)) {
        router.refresh()
        return
      }

      if (message.sender_id === currentUserId) return

      const activeRoom = activeRoomRef.current
      if (
        (message.channel_id && activeRoom?.kind === 'channel' && activeRoom.id === message.channel_id) ||
        (message.dm_thread_id && activeRoom?.kind === 'dm' && activeRoom.id === message.dm_thread_id)
      ) {
        return
      }

      if (message.channel_id && knownChannelIds.has(message.channel_id)) {
        setUnread((current) => ({
          ...current,
          channels: {
            ...current.channels,
            [message.channel_id!]: (current.channels[message.channel_id!] ?? 0) + 1,
          },
        }))
        return
      }

      if (message.dm_thread_id && knownDmIds.has(message.dm_thread_id)) {
        setUnread((current) => ({
          ...current,
          directMessages: {
            ...current.directMessages,
            [message.dm_thread_id!]: (current.directMessages[message.dm_thread_id!] ?? 0) + 1,
          },
        }))
      }
    }

    void (async () => {
      const {
        data: { session },
        error: sessionError,
      } = await client.auth.getSession()
      if (!active) return
      if (sessionError || !session?.access_token) {
        setUnreadRealtimeStatus('auth-missing')
        return
      }

      await client.realtime.setAuth(session.access_token)
      if (!active) return

      realtimeChannel = client
        .channel(`sidebar-unread:${currentUserId}`)
        .on('system', '*', (payload) => {
          const system = payload as { extension?: string; status?: string }
          if (system.extension !== 'postgres_changes') return
          if (system.status === 'ok') {
            void syncUnread().finally(() => {
              if (active) setUnreadRealtimeStatus('ready')
            })
          } else if (system.status === 'error' || system.status === 'timeout') {
            setUnreadRealtimeStatus(`postgres-${system.status}`)
          }
        })
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          (payload) => handleInsert(payload.new as unknown as RealtimeMessageRow),
        )
        .subscribe((status) => {
          if (!active || status === 'SUBSCRIBED') return
          setUnreadRealtimeStatus(status.toLowerCase())
        })
    })()

    const syncOnFocus = () => void syncUnread()
    const syncOnVisibility = () => {
      if (document.visibilityState === 'visible') void syncUnread()
    }
    window.addEventListener('focus', syncOnFocus)
    document.addEventListener('visibilitychange', syncOnVisibility)

    return () => {
      active = false
      window.removeEventListener('focus', syncOnFocus)
      document.removeEventListener('visibilitychange', syncOnVisibility)
      if (realtimeChannel) void client.removeChannel(realtimeChannel)
    }
  }, [currentUserId, knownChannelIds, knownDmIds, router])

  const liveChannels = channels.map((channel) => ({
    ...channel,
    unreadCount: unread.channels[channel.id] ?? 0,
  }))
  const liveDirectMessages = directMessages.map((direct) => ({
    ...direct,
    unreadCount: unread.directMessages[direct.id] ?? 0,
  }))

  const sidebar = (
    <Sidebar
      profile={profile}
      currentUserId={currentUserId}
      channelProfiles={channelProfiles}
      channels={liveChannels}
      directMessages={liveDirectMessages}
      directCandidates={directCandidates}
      communities={communities}
      theme={theme}
      isAdmin={isAdmin}
      unreadRealtimeStatus={unreadRealtimeStatus}
    />
  )

  return (
    <div
      data-keychats-workspace
      data-theme={theme}
      className={`min-h-screen ${dark ? 'bg-[#111111] text-white' : 'bg-white text-black'}`}
    >
      <details className="group md:hidden">
        <summary
          data-mobile-menu-trigger="true"
          className={`fixed left-4 top-4 z-40 cursor-pointer list-none rounded-xl border px-3 py-2 text-sm font-medium shadow-sm ${
            dark ? 'border-white/10 bg-[#181818] text-white' : 'border-black/10 bg-white text-black'
          }`}
        >
          메뉴
        </summary>
        <div className="fixed inset-0 z-30 bg-black/40">
          <div className="h-full w-[min(18rem,85vw)] shadow-xl">{sidebar}</div>
        </div>
      </details>

      <div className="grid min-h-screen md:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="hidden md:block">
          <div className="sticky top-0 h-screen">{sidebar}</div>
        </div>
        <main className={`min-w-0 pt-16 md:pt-0 ${dark ? 'bg-[#111111]' : 'bg-white'}`}>
          {children}
        </main>
      </div>
    </div>
  )
}
