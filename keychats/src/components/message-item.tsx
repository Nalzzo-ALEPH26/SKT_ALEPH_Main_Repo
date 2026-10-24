import type { AttachmentMetadata } from '@/lib/files/supabase'
import { splitMessageText } from '@/lib/url-preview/url'
import { UrlPreviewCard } from '@/components/url-preview-card'

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
  attachments?: AttachmentMetadata[]
}

type MessageItemProps = {
  message: MessageListItem
  currentUserId: string
  isAdmin: boolean
  continuesPrevious?: boolean
  continuesNext?: boolean
  onReply?: (messageId: number) => void
  onEdit?: (messageId: number) => void
  onDelete?: (messageId: number) => void
  onToggleReaction?: (messageId: number, emoji: string) => void
  onTogglePin?: (messageId: number) => void
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉'] as const

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function MessageBody({ body }: { body: string | null }) {
  return (
    <>
      {splitMessageText(body).map((part, index) =>
        part.type === 'url' ? (
          <a key={`${part.value}-${index}`} href={part.value} target="_blank" rel="noreferrer nofollow" className="underline underline-offset-2">
            {part.value}
          </a>
        ) : (
          <span key={`text-${index}`}>{part.value}</span>
        ),
      )}
    </>
  )
}

export function MessageItem({
  message,
  currentUserId,
  isAdmin,
  continuesPrevious = false,
  continuesNext = false,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
  onTogglePin,
}: MessageItemProps) {
  const isDeleted = Boolean(message.deletedAt)
  const isOwn = message.sender.userId === currentUserId
  const canEdit = !isDeleted && isOwn
  const canDelete = !isDeleted && (isOwn || isAdmin)
  const reactions = message.reactions ?? []
  const attachments = message.attachments ?? []
  const showSenderInfo = !continuesPrevious

  const avatar = (
    <div
      data-message-avatar-side={isOwn ? 'right' : 'left'}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 ${isOwn ? 'order-2' : 'order-1'}`}
    >
      {message.sender.displayName.slice(0, 1).toUpperCase()}
    </div>
  )

  const ownBubbleShape = continuesPrevious && continuesNext
    ? 'rounded-2xl rounded-r-md'
    : continuesPrevious
      ? 'rounded-2xl rounded-tr-md'
      : continuesNext
        ? 'rounded-2xl rounded-br-md'
        : 'rounded-2xl rounded-tr-sm'

  return (
    <article
      data-message-id={message.id}
      data-own-message={isOwn}
      data-message-group-start={showSenderInfo ? 'true' : 'false'}
      data-message-group-continuation={continuesPrevious ? 'true' : 'false'}
      className={`group flex gap-3 px-1 ${continuesPrevious ? 'py-0.5' : 'border-t border-zinc-100 py-3 first:border-t-0 dark:border-zinc-900'} ${isOwn ? 'justify-end' : 'justify-start'}`}
    >
      {!isOwn ? (showSenderInfo ? avatar : <div aria-hidden className="order-1 h-9 w-9 shrink-0" />) : null}
      <div className={`min-w-0 max-w-[min(42rem,82%)] ${isOwn ? 'order-1 flex flex-col items-end text-right' : 'order-2 flex-1'}`}>
        {showSenderInfo ? (
          <div data-message-sender-meta className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${isOwn ? 'justify-end' : ''}`}>
            <span className="text-sm font-semibold">{message.sender.displayName}</span>
            <span data-identity-font="true" className="text-xs text-zinc-500">@{message.sender.username}</span>
            <time className="text-xs text-zinc-400" dateTime={message.createdAt}>
              {new Date(message.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </time>
            {message.isPinned ? <span data-message-pinned className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">고정됨</span> : null}
          </div>
        ) : message.isPinned ? (
          <div className={`mb-0.5 flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <span data-message-pinned className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">고정됨</span>
          </div>
        ) : null}

        {message.replyTo ? (
          <blockquote className={`${showSenderInfo ? 'mt-2' : 'mt-1'} w-full border-l-2 border-zinc-300 pl-3 text-left text-xs text-zinc-500 dark:border-zinc-700`}>
            <span className="font-medium">{message.replyTo.displayName}</span>
            <p className="mt-0.5 truncate">{message.replyTo.deletedAt ? '삭제된 메시지입니다.' : message.replyTo.body}</p>
          </blockquote>
        ) : null}

        <div className={`${showSenderInfo ? 'mt-1' : 'mt-0'} max-w-full whitespace-pre-wrap break-words text-left text-sm leading-6 ${isOwn ? `${ownBubbleShape} bg-zinc-950 px-3 py-2 text-white dark:bg-white dark:text-zinc-950` : ''}`}>
          {isDeleted ? (
            <span className="italic text-zinc-500">삭제된 메시지입니다.</span>
          ) : (
            <>
              <MessageBody body={message.body} />
              {message.editedAt ? <span className="ml-1 text-xs opacity-60">(수정됨)</span> : null}
            </>
          )}
        </div>

        <div className={`w-full ${isOwn ? 'flex justify-end' : ''}`}>
          <UrlPreviewCard messageId={message.id} body={message.body} deleted={isDeleted} />
        </div>

        {!isDeleted && attachments.length > 0 ? (
          <div className={`mt-2 flex max-w-xl flex-col gap-2 ${isOwn ? 'items-end' : ''}`} data-message-attachments>
            {attachments.map((attachment) => {
              const href = `/chats/api/attachments/${attachment.id}`
              const isImage = attachment.mimeType.startsWith('image/')
              return isImage ? (
                <a key={attachment.id} href={href} target="_blank" rel="noreferrer" className="block w-fit">
                  <img src={href} alt={attachment.originalName} className="max-h-80 max-w-full rounded-xl border border-black/10 object-contain dark:border-white/10" />
                </a>
              ) : (
                <a key={attachment.id} href={href} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-4 rounded-xl border border-black/10 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5">
                  <span className="min-w-0 truncate">{attachment.originalName}</span>
                  <span className="shrink-0 text-xs text-zinc-500">{formatBytes(attachment.sizeBytes)}</span>
                </a>
              )
            })}
          </div>
        ) : null}

        {!isDeleted && reactions.length > 0 ? (
          <div className={`mt-2 flex flex-wrap gap-1.5 ${isOwn ? 'justify-end' : ''}`} data-message-reactions>
            {reactions.map((reaction) => (
              <button key={reaction.emoji} type="button" data-reaction-emoji={reaction.emoji} data-reacted-by-current-user={reaction.reactedByCurrentUser} aria-pressed={reaction.reactedByCurrentUser} onClick={() => onToggleReaction?.(message.id, reaction.emoji)} className={`rounded-full border px-2 py-0.5 text-xs transition ${reaction.reactedByCurrentUser ? 'border-zinc-400 bg-zinc-100 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900'}`}>
                {reaction.emoji} {reaction.count}
              </button>
            ))}
          </div>
        ) : null}

        {!isDeleted ? (
          <div className={`mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-400 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 ${isOwn ? 'justify-end' : ''}`}>
            <button type="button" data-reply-to={message.id} onClick={() => onReply?.(message.id)}>답글</button>
            {QUICK_REACTIONS.map((emoji) => (
              <button key={emoji} type="button" aria-label={`${emoji} 반응`} data-quick-reaction={emoji} onClick={() => onToggleReaction?.(message.id, emoji)}>{emoji}</button>
            ))}
            <button type="button" data-toggle-pin={message.id} onClick={() => onTogglePin?.(message.id)}>{message.isPinned ? '고정 해제' : '고정'}</button>
            {canEdit ? <button type="button" data-edit-message={message.id} onClick={() => onEdit?.(message.id)}>수정</button> : null}
            {canDelete ? <button type="button" data-delete-message={message.id} onClick={() => onDelete?.(message.id)}>삭제</button> : null}
          </div>
        ) : null}
      </div>
      {isOwn ? (showSenderInfo ? avatar : <div aria-hidden className="order-2 h-9 w-9 shrink-0" />) : null}
    </article>
  )
}
