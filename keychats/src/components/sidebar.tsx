import Link from 'next/link'

import {
  createChannelAction,
  joinChannelByCodeAction,
  manageChannelsAction,
} from '@/app/(workspace)/channel/channel-actions'
import {
  manageDirectMessagesAction,
  startDirectMessageAction,
} from '@/app/(workspace)/dm/dm-actions'
import { Avatar } from '@/components/avatar'
import { ChannelDialog } from '@/components/channel-dialog'
import type { KeychatsTheme } from '@/lib/settings/theme'

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

type DirectCandidate = {
  userId: string
  displayName: string
}

type ChannelProfile = {
  userId: string
  displayName: string
  username: string
}

type SidebarProps = {
  profile: {
    displayName: string
    avatarPath: string | null
  }
  currentUserId?: string
  channelProfiles?: ChannelProfile[]
  channels: ChannelItem[]
  directMessages: DirectItem[]
  directCandidates?: DirectCandidate[]
  theme?: KeychatsTheme
  isAdmin?: boolean
  unreadRealtimeStatus?: string
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      data-unread-badge
      className="min-w-5 rounded-full bg-black px-1.5 py-0.5 text-center text-xs font-semibold text-white dark:bg-white dark:text-black"
    >
      {count}
    </span>
  )
}

export function Sidebar({
  profile,
  currentUserId = '',
  channelProfiles = [],
  channels,
  directMessages,
  directCandidates = [],
  theme = 'light',
  isAdmin = false,
  unreadRealtimeStatus = 'connecting',
}: SidebarProps) {
  const dark = theme === 'dark'
  const muted = dark ? 'text-white/45' : 'text-black/40'
  const item = dark ? 'text-white/75 hover:bg-white/5' : 'text-black/70 hover:bg-black/5'
  const panel = dark ? 'border-white/10 bg-[#202020]' : 'border-black/10 bg-white'
  const manageableLeaveChannels = channels.filter((channel) => channel.canLeave)
  const manageableDeleteChannels = channels.filter((channel) => channel.canDelete)

  return (
    <aside
      data-unread-realtime-status={unreadRealtimeStatus}
      className={`flex h-full w-full flex-col border-r p-4 md:w-72 ${
        dark ? 'border-white/10 bg-[#181818] text-white' : 'border-black/10 bg-[#f7f7f5] text-black'
      }`}
    >
      <div className={`px-2 pb-5 pt-2 text-sm font-semibold tracking-[0.18em] ${dark ? 'text-white/75' : 'text-black/70'}`}>
        KEYCHATS
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto">
        <section>
          <div className={`mb-2 flex items-center justify-between px-2 text-xs font-semibold tracking-[0.14em] ${muted}`}>
            <span>CHANNELS</span>
            <div className="flex items-center gap-1.5">
              {(manageableLeaveChannels.length > 0 || manageableDeleteChannels.length > 0) ? (
                <details className="relative">
                  <summary className={`cursor-pointer list-none rounded-md px-1.5 py-1 text-[11px] tracking-normal ${dark ? 'text-white/60 hover:bg-white/5' : 'text-black/55 hover:bg-black/5'}`}>
                    채널 관리
                  </summary>
                  <div className={`absolute right-0 top-7 z-30 w-64 rounded-xl border p-3 text-left shadow-xl ${panel}`}>
                    {manageableLeaveChannels.length > 0 ? (
                      <form action={manageChannelsAction} className="space-y-2">
                        <p className="text-xs font-semibold tracking-normal">나갈 채널 선택</p>
                        <div className="max-h-40 space-y-1.5 overflow-y-auto">
                          {manageableLeaveChannels.map((channel) => (
                            <label key={`leave-${channel.id}`} className="flex items-center gap-2 text-xs font-normal tracking-normal">
                              <input type="checkbox" name="channelIds" value={channel.id} />
                              <span className="min-w-0 truncate">#{channel.name}</span>
                            </label>
                          ))}
                        </div>
                        <button name="operation" value="leave" type="submit" className={`w-full rounded-lg border px-2 py-1.5 text-xs font-semibold tracking-normal ${dark ? 'border-white/15 hover:bg-white/5' : 'border-black/10 hover:bg-black/5'}`}>
                          선택한 채널 나가기
                        </button>
                      </form>
                    ) : null}

                    {manageableDeleteChannels.length > 0 ? (
                      <form action={manageChannelsAction} className={`${manageableLeaveChannels.length > 0 ? 'mt-3 border-t pt-3' : ''} space-y-2 ${dark ? 'border-white/10' : 'border-black/10'}`}>
                        <p className="text-xs font-semibold tracking-normal">삭제할 채널 선택</p>
                        <div className="max-h-40 space-y-1.5 overflow-y-auto">
                          {manageableDeleteChannels.map((channel) => (
                            <label key={`delete-${channel.id}`} className="flex items-center gap-2 text-xs font-normal tracking-normal">
                              <input type="checkbox" name="channelIds" value={channel.id} />
                              <span className="min-w-0 truncate">#{channel.name}</span>
                            </label>
                          ))}
                        </div>
                        <button name="operation" value="delete" type="submit" className="w-full rounded-lg border border-red-500/30 px-2 py-1.5 text-xs font-semibold tracking-normal text-red-600 hover:bg-red-500/5 dark:text-red-400">
                          선택한 채널 삭제
                        </button>
                      </form>
                    ) : null}
                  </div>
                </details>
              ) : null}
              <ChannelDialog
                variant="sidebar"
                profiles={channelProfiles}
                currentUserId={currentUserId}
                action={createChannelAction}
              />
            </div>
          </div>
          <div className="space-y-1">
            {channels.map((channel) => (
              <Link
                key={channel.id}
                href={`/channel/${channel.id}`}
                className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-sm ${item}`}
              >
                <span>#{channel.name}</span>
                <UnreadBadge count={channel.unreadCount} />
              </Link>
            ))}
          </div>
          <form action={joinChannelByCodeAction} className="mt-3 flex gap-1.5 px-2">
            <input
              name="joinCode"
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="100000 · General"
              aria-label="채널 입장 코드"
              className={`min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-xs outline-none ${
                dark
                  ? 'border-white/10 bg-white/5 text-white placeholder:text-white/30'
                  : 'border-black/10 bg-white text-black placeholder:text-black/30'
              }`}
            />
            <button type="submit" className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${dark ? 'border-white/10' : 'border-black/10'}`}>
              입장
            </button>
          </form>
        </section>

        <section>
          <div className={`mb-2 flex items-center justify-between px-2 text-xs font-semibold tracking-[0.14em] ${muted}`}>
            <span>DIRECT</span>
            <div className="flex items-center gap-1.5">
              {directMessages.length > 0 ? (
                <details className="relative">
                  <summary className={`cursor-pointer list-none rounded-md px-1.5 py-1 text-[11px] tracking-normal ${dark ? 'text-white/60 hover:bg-white/5' : 'text-black/55 hover:bg-black/5'}`}>
                    DM 관리
                  </summary>
                  <form action={manageDirectMessagesAction} className={`absolute right-0 top-7 z-20 w-56 rounded-xl border p-3 shadow-lg ${panel}`}>
                    <p className="mb-2 text-xs font-semibold tracking-normal">나갈 DM 선택</p>
                    <div className="max-h-48 space-y-1.5 overflow-y-auto">
                      {directMessages.map((direct) => (
                        <label key={`manage-${direct.id}`} className="flex items-center gap-2 text-xs font-normal tracking-normal">
                          <input type="checkbox" name="dmThreadIds" value={direct.id} />
                          <span className="min-w-0 truncate">{direct.displayName}</span>
                        </label>
                      ))}
                    </div>
                    <button type="submit" className={`mt-3 w-full rounded-lg border px-2 py-1.5 text-xs font-semibold tracking-normal ${dark ? 'border-white/15 hover:bg-white/5' : 'border-black/10 hover:bg-black/5'}`}>
                      선택한 DM 나가기
                    </button>
                  </form>
                </details>
              ) : null}
              {directCandidates.length > 0 ? (
                <details className="relative">
                  <summary className={`cursor-pointer list-none rounded-md px-1.5 py-1 text-[11px] tracking-normal ${dark ? 'text-white/60 hover:bg-white/5' : 'text-black/55 hover:bg-black/5'}`}>
                    새 DM
                  </summary>
                  <div className={`absolute right-0 top-7 z-20 w-48 rounded-xl border p-1.5 shadow-lg ${panel}`}>
                    {directCandidates.map((candidate) => (
                      <form key={candidate.userId} action={startDirectMessageAction}>
                        <input type="hidden" name="otherUserId" value={candidate.userId} />
                        <button type="submit" className={`w-full truncate rounded-lg px-2.5 py-2 text-left text-sm ${item}`}>
                          {candidate.displayName}
                        </button>
                      </form>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </div>
          <div className="space-y-1">
            {directMessages.map((direct) => (
              <Link key={direct.id} href={`/dm/${direct.id}`} className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-sm ${item}`}>
                <span>{direct.displayName}</span>
                <UnreadBadge count={direct.unreadCount} />
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className={`mb-2 px-2 text-xs font-semibold tracking-[0.14em] ${muted}`}>COMMUNITY</div>
          <Link href="/feedback" className={`block rounded-lg px-2.5 py-2 text-sm ${item}`}>
            피드백
          </Link>
        </section>

        {isAdmin ? (
          <section>
            <div className={`mb-2 px-2 text-xs font-semibold tracking-[0.14em] ${muted}`}>ADMIN</div>
            <Link href="/admin" className={`block rounded-lg px-2.5 py-2 text-sm ${item}`}>
              관리자
            </Link>
          </section>
        ) : null}
      </nav>

      <Link href="/settings" className={`mt-4 flex items-center gap-3 rounded-xl border p-3 ${dark ? 'border-white/10 bg-white/5' : 'border-black/5 bg-white'}`}>
        <Avatar displayName={profile.displayName} avatarPath={profile.avatarPath} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{profile.displayName}</span>
      </Link>
    </aside>
  )
}
