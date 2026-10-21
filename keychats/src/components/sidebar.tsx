import Link from 'next/link'

import { Avatar } from '@/components/avatar'

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

type SidebarProps = {
  profile: {
    displayName: string
    avatarPath: string | null
  }
  channels: ChannelItem[]
  directMessages: DirectItem[]
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null

  return (
    <span className="min-w-5 rounded-full bg-black px-1.5 py-0.5 text-center text-xs font-semibold text-white">
      {count}
    </span>
  )
}

export function Sidebar({ profile, channels, directMessages }: SidebarProps) {
  return (
    <aside className="flex h-full w-full flex-col border-r border-black/10 bg-[#f7f7f5] p-4 md:w-72">
      <div className="px-2 pb-5 pt-2 text-sm font-semibold tracking-[0.18em] text-black/70">KEYCHATS</div>

      <nav className="flex-1 space-y-6 overflow-y-auto">
        <section>
          <div className="mb-2 flex items-center justify-between px-2 text-xs font-semibold tracking-[0.14em] text-black/40">
            <span>CHANNELS</span>
            <button type="button" aria-label="채널 만들기" className="text-lg leading-none text-black/45">+</button>
          </div>
          <div className="space-y-1">
            {channels.map((channel) => (
              <Link
                key={channel.id}
                href={`/channel/${channel.id}`}
                className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-black/70 hover:bg-black/5"
              >
                <span>#{channel.name}</span>
                <UnreadBadge count={channel.unreadCount} />
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 px-2 text-xs font-semibold tracking-[0.14em] text-black/40">DIRECT</div>
          <div className="space-y-1">
            {directMessages.map((direct) => (
              <Link
                key={direct.id}
                href={`/dm/${direct.id}`}
                className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-black/70 hover:bg-black/5"
              >
                <span>{direct.displayName}</span>
                <UnreadBadge count={direct.unreadCount} />
              </Link>
            ))}
          </div>
        </section>
      </nav>

      <Link href="/settings" className="mt-4 flex items-center gap-3 rounded-xl border border-black/5 bg-white p-3">
        <Avatar displayName={profile.displayName} avatarPath={profile.avatarPath} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{profile.displayName}</span>
      </Link>
    </aside>
  )
}
