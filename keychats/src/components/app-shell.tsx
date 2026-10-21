import type { ReactNode } from 'react'

import { Sidebar } from '@/components/sidebar'

type AppShellProps = {
  profile: {
    displayName: string
    avatarPath: string | null
  }
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
  children: ReactNode
}

export function AppShell({ profile, channels, directMessages, children }: AppShellProps) {
  return (
    <div data-keychats-workspace className="min-h-screen bg-white text-black">
      <button
        type="button"
        data-mobile-menu-trigger="true"
        aria-label="메뉴 열기"
        className="fixed left-4 top-4 z-20 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium shadow-sm md:hidden"
      >
        메뉴
      </button>

      <div className="grid min-h-screen md:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="hidden md:block">
          <div className="sticky top-0 h-screen">
            <Sidebar profile={profile} channels={channels} directMessages={directMessages} />
          </div>
        </div>

        <main className="min-w-0 bg-white pt-16 md:pt-0">{children}</main>
      </div>

      <div className="sr-only" aria-hidden="true">
        <Sidebar profile={profile} channels={channels} directMessages={directMessages} />
      </div>
    </div>
  )
}
