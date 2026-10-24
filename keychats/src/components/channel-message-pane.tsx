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
  return (
    <ConversationMessagePane
      key={channelId}
      target={{ kind: 'channel', id: channelId }}
      {...props}
    />
  )
}