import { MessageItem, type MessageListItem } from '@/components/message-item'

type MessageListProps = {
  messages: MessageListItem[]
  currentUserId: string
  isAdmin: boolean
  onReply?: (messageId: number) => void
  onEdit?: (messageId: number) => void
  onDelete?: (messageId: number) => void
}

export function MessageList({
  messages,
  currentUserId,
  isAdmin,
  onReply,
  onEdit,
  onDelete,
}: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-zinc-500">
        아직 메시지가 없습니다.
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900" data-message-list>
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
