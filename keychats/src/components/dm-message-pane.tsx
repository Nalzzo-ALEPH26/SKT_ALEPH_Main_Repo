'use client'

import { usePathname } from 'next/navigation'

import { ConversationMessagePane } from '@/components/conversation-message-pane'
import type { MessagePresentationProfile } from '@/lib/messages/presentation'
import type { RealtimeMessageRow } from '@/lib/messages/realtime'

type DmMessagePaneProps = {
  dmThreadId: string
  initialMessages: RealtimeMessageRow[]
  profiles: MessagePresentationProfile[]
  currentUserId: string
  isAdmin: boolean
}

export function DmMessagePane({ dmThreadId, ...props }: DmMessagePaneProps) {
  const pathname = usePathname()
  const isCurrentRoute = pathname.endsWith(`/dm/${dmThreadId}`)

  if (!isCurrentRoute) {
    return (
      <section
        className="flex min-h-0 flex-1 flex-col pt-4"
        data-conversation-message-pane
        data-dm-message-pane
        data-realtime-status="connecting"
      />
    )
  }

  return (
    <ConversationMessagePane
      key={dmThreadId}
      target={{ kind: 'dm', id: dmThreadId }}
      {...props}
    />
  )
}
