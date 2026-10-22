'use client'

import { usePathname } from 'next/navigation'

import { ConversationMessagePane } from '@/components/conversation-message-pane'
import type { MessagePresentationProfile } from '@/lib/messages/presentation'
import type { RealtimeMessageRow } from '@/lib/messages/realtime'

type ChannelMessagePaneProps = {
  channelId: string
  initialMessages: RealtimeMessageRow[]
  profiles: MessagePresentationProfile[]
  currentUserId: string
  isAdmin: boolean
}

export function ChannelMessagePane({ channelId, ...props }: ChannelMessagePaneProps) {
  const pathname = usePathname()
  const isCurrentRoute = pathname.endsWith(`/channel/${channelId}`)

  if (!isCurrentRoute) {
    return (
      <section
        className="flex min-h-0 flex-1 flex-col pt-4"
        data-conversation-message-pane
        data-channel-message-pane
        data-realtime-status="connecting"
      />
    )
  }

  return (
    <ConversationMessagePane
      key={channelId}
      target={{ kind: 'channel', id: channelId }}
      {...props}
    />
  )
}
