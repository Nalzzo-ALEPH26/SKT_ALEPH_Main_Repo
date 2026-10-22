import type { ReactNode } from 'react'

import { Sidebar } from '@/components/sidebar'
import type { KeychatsTheme } from '@/lib/settings/theme'

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
  channels: Array<{
    id: string
    name: string
    unreadCount: number
  }>
  directMessages: Array<{
    id: string
    displayName: string
    unreadCount: number
  }>
  directCandidates?: Array<{
    userId: string
    displayName: string
  }>
  theme?: KeychatsTheme
  isAdmin?: boolean
  children?: ReactNode
}

export function AppShell({
  profile,
  currentUserId = '',
  channelProfiles = [],
  channels,
  directMessages,
  directCandidates = [],
  theme = 'light',
  isAdmin = false,
  children,
}: AppShellProps) {
  const dark = theme === 'dark'
  const sidebar = (
    <Sidebar
      profile={profile}
      currentUserId={currentUserId}
      channelProfiles={channelProfiles}
      channels={channels}
      directMessages={directMessages}
      directCandidates={directCandidates}
      theme={theme}
      isAdmin={isAdmin}
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
