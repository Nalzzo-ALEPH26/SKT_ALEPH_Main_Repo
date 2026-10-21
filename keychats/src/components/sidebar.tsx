import Link from 'next/link'

import { startDirectMessageAction } from '@/app/(workspace)/dm/dm-actions'
import { Avatar } from '@/components/avatar'
import type { KeychatsTheme } from '@/lib/settings/theme'

type ChannelItem = {
  id: string
  name: string
  unreadCount: number
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

type SidebarProps = {
  profile: {
    displayName: string
    avatarPath: string | null
  }
  channels: ChannelItem[]
  directMessages: DirectItem[]
  directCandidates?: DirectCandidate[]
  theme?: KeychatsTheme
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null

  return (
    <span className="min-w-5 rounded-full bg-black px-1.5 py-0.5 text-center text-xs font-semibold text-white">
      {count}
    </span>
  )
}

export function Sidebar({
  profile,
  channels,
  directMessages,
  directCandidates = [],
  theme = 'light',
}: SidebarProps) {
  const dark = theme === 'dark'
  const muted = dark ? 'text-white/45' : 'text-black/40'
  const item = dark ? 'text-white/75 hover:bg-white/5' : 'text-black/70 hover:bg-black/5'

  return (
    <aside
      className={`flex h-full w-full flex-col border-r p-4 md:w-72 ${
        dark ? 'border-white/10 bg-[#181818] text-white' : 'border-black/10 bg-[#f7f7f5] text-black'
      }`}
    >
      <div
        className={`px-2 pb-5 pt-2 text-sm font-semibold tracking-[0.18em] ${
          dark ? 'text-white/75' : 'text-black/70'
        }`}
      >
        KEYCHATS
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto">
        <section>
          <div
            className={`mb-2 flex items-center justify-between px-2 text-xs font-semibold tracking-[0.14em] ${muted}`}
          >
            <span>CHANNELS</span>
            <button
              type="button"
              aria-label="채널 만들기"
              className={dark ? 'text-lg leading-none text-white/50' : 'text-lg leading-none text-black/45'}
            >
              +
            </button>
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
        </section>

        <section>
          <div className={`mb-2 flex items-center justify-between px-2 text-xs font-semibold tracking-[0.14em] ${muted}`}>
            <span>DIRECT</span>
            {directCandidates.length > 0 ? (
              <details className="relative">
                <summary
                  className={`cursor-pointer list-none rounded-md px-1.5 py-1 text-[11px] tracking-normal ${
                    dark ? 'text-white/60 hover:bg-white/5' : 'text-black/55 hover:bg-black/5'
                  }`}
                >
                  새 DM
                </summary>
                <div
                  className={`absolute right-0 top-7 z-20 w-48 rounded-xl border p-1.5 shadow-lg ${
                    dark ? 'border-white/10 bg-[#202020]' : 'border-black/10 bg-white'
                  }`}
                >
                  {directCandidates.map((candidate) => (
                    <form key={candidate.userId} action={startDirectMessageAction}>
                      <input type="hidden" name="otherUserId" value={candidate.userId} />
                      <button
                        type="submit"
                        className={`w-full truncate rounded-lg px-2.5 py-2 text-left text-sm ${item}`}
                      >
                        {candidate.displayName}
                      </button>
                    </form>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
          <div className="space-y-1">
            {directMessages.map((direct) => (
              <Link
                key={direct.id}
                href={`/dm/${direct.id}`}
                className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-sm ${item}`}
              >
                <span>{direct.displayName}</span>
                <UnreadBadge count={direct.unreadCount} />
              </Link>
            ))}
          </div>
        </section>
      </nav>

      <Link
        href="/settings"
        className={`mt-4 flex items-center gap-3 rounded-xl border p-3 ${
          dark ? 'border-white/10 bg-white/5' : 'border-black/5 bg-white'
        }`}
      >
        <Avatar displayName={profile.displayName} avatarPath={profile.avatarPath} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{profile.displayName}</span>
      </Link>
    </aside>
  )
}
