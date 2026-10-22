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
  return (
    <ConversationMessagePane
      key={dmThreadId}
      target={{ kind: 'dm', id: dmThreadId }}
      {...props}
    />
  )
}