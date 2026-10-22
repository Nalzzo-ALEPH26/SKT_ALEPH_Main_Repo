type MessageSender = {
  userId: string
  displayName: string
  username: string
  avatarPath: string | null
}

export type MessageReactionItem = {
  emoji: string
  count: number
  reactedByCurrentUser: boolean
}

export type MessageListItem = {
  id: number
  body: string | null
  sender: MessageSender
  replyTo: {
    id: number
    body: string | null
    displayName: string
    deletedAt: string | null
  } | null
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
  isPinned?: boolean
  reactions?: MessageReactionItem[]
}

type MessageItemProps = {
  message: MessageListItem
  currentUserId: string
  isAdmin: boolean
  onReply?: (messageId: number) => void
  onEdit?: (messageId: number) => void
  onDelete?: (messageId: number) => void
  onToggleReaction?: (messageId: number, emoji: string) => void
  onTogglePin?: (messageId: number) => void
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉'] as const

export function MessageItem({
  message,
  currentUserId,
  isAdmin,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
  onTogglePin,
}: MessageItemProps) {
  const isDeleted = Boolean(message.deletedAt)
  const canEdit = !isDeleted && message.sender.userId === currentUserId
  const canDelete = !isDeleted && (message.sender.userId === currentUserId || isAdmin)
  const reactions = message.reactions ?? []

  return (
    <article data-message-id={message.id} className="group flex gap-3 px-1 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
        {message.sender.displayName.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-sm font-semibold">{message.sender.displayName}</span>
          <span className="text-xs text-zinc-500">@{message.sender.username}</span>
          <time className="text-xs text-zinc-400" dateTime={message.createdAt}>
            {new Date(message.createdAt).toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
          {message.isPinned ? (
            <span
              data-message-pinned
              className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
            >
              고정됨
            </span>
          ) : null}
        </div>

        {message.replyTo ? (
          <blockquote className="mt-2 border-l-2 border-zinc-300 pl-3 text-xs text-zinc-500 dark:border-zinc-700">
            <span className="font-medium">{message.replyTo.displayName}</span>
            <p className="mt-0.5 truncate">
              {message.replyTo.deletedAt ? '삭제된 메시지입니다.' : message.replyTo.body}
            </p>
          </blockquote>
        ) : null}

        <div className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">
          {isDeleted ? (
            <span className="italic text-zinc-500">삭제된 메시지입니다.</span>
          ) : (
            <>
              {message.body}
              {message.editedAt ? <span className="ml-1 text-xs text-zinc-400">(수정됨)</span> : null}
            </>
          )}
        </div>

        {!isDeleted && reactions.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5" data-message-reactions>
            {reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                type="button"
                data-reaction-emoji={reaction.emoji}
                data-reacted-by-current-user={reaction.reactedByCurrentUser}
                aria-pressed={reaction.reactedByCurrentUser}
                onClick={() => onToggleReaction?.(message.id, reaction.emoji)}
                className={`rounded-full border px-2 py-0.5 text-xs transition ${
                  reaction.reactedByCurrentUser
                    ? 'border-zinc-400 bg-zinc-100 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white'
                    : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900'
                }`}
              >
                {reaction.emoji} {reaction.count}
              </button>
            ))}
          </div>
        ) : null}

        {!isDeleted ? (
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-400 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
            <button type="button" data-reply-to={message.id} onClick={() => onReply?.(message.id)}>
              답글
            </button>
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`${emoji} 반응`}
                data-quick-reaction={emoji}
                onClick={() => onToggleReaction?.(message.id, emoji)}
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              data-toggle-pin={message.id}
              onClick={() => onTogglePin?.(message.id)}
            >
              {message.isPinned ? '고정 해제' : '고정'}
            </button>
            {canEdit ? (
              <button type="button" data-edit-message={message.id} onClick={() => onEdit?.(message.id)}>
                수정
              </button>
            ) : null}
            {canDelete ? (
              <button type="button" data-delete-message={message.id} onClick={() => onDelete?.(message.id)}>
                삭제
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  )
}
