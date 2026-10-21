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
      <details className="group md:hidden">
        <summary
          data-mobile-menu-trigger="true"
          className="fixed left-4 top-4 z-40 cursor-pointer list-none rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium shadow-sm"
        >
          메뉴
        </summary>
        <div className="fixed inset-0 z-30 bg-black/30">
          <div className="h-full w-[min(18rem,85vw)] bg-[#f7f7f5] shadow-xl">
            <Sidebar profile={profile} channels={channels} directMessages={directMessages} />
          </div>
        </div>
      </details>

      <div className="grid min-h-screen md:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="hidden md:block">
          <div className="sticky top-0 h-screen">
            <Sidebar profile={profile} channels={channels} directMessages={directMessages} />
          </div>
        </div>

        <main className="min-w-0 bg-white pt-16 md:pt-0">{children}</main>
      </div>
    </div>
  )
}
