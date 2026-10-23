'use client'

import { useLayoutEffect, useRef } from 'react'

import { MessageItem, type MessageListItem } from '@/components/message-item'

type MessageListProps = {
  messages: MessageListItem[]
  currentUserId: string
  isAdmin: boolean
  onReply?: (messageId: number) => void
  onEdit?: (messageId: number) => void
  onDelete?: (messageId: number) => void
  onToggleReaction?: (messageId: number, emoji: string) => void
  onTogglePin?: (messageId: number) => void
}

export function MessageList({
  messages,
  currentUserId,
  isAdmin,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
  onTogglePin,
}: MessageListProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const didInitialScrollRef = useRef(false)

  useLayoutEffect(() => {
    if (didInitialScrollRef.current) return
    const scrollArea = contentRef.current?.parentElement
    if (!scrollArea) return

    scrollArea.scrollTop = scrollArea.scrollHeight
    didInitialScrollRef.current = true
  }, [messages.length])

  if (messages.length === 0) {
    return (
      <div
        ref={contentRef}
        data-message-scroll-area
        className="flex flex-1 items-center justify-center py-16 text-sm text-zinc-500"
      >
        아직 메시지가 없습니다.
      </div>
    )
  }

  return (
    <div
      ref={contentRef}
      className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900"
      data-message-list
      data-message-scroll-area
    >
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleReaction={onToggleReaction}
          onTogglePin={onTogglePin}
        />
      ))}
    </div>
  )
}
