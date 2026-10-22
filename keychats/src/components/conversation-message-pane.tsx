'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'

import {
  deleteChannelMessageAction,
  editChannelMessageAction,
  loadOlderChannelMessagesAction,
  sendChannelMessageAction,
} from '@/app/(workspace)/channel/message-actions'
import {
  deleteDmMessageAction,
  editDmMessageAction,
  loadOlderDmMessagesAction,
  sendDmMessageAction,
} from '@/app/(workspace)/dm/message-actions'
import { MessageList } from '@/components/message-list'
import {
  mergeMessageHistory,
  messageRecordToRealtimeRow,
  toMessageListItems,
  type MessagePresentationProfile,
} from '@/lib/messages/presentation'
import {
  reconcileMessageChange,
  subscribeToChannelMessages,
  subscribeToDmMessages,
  type RealtimeMessageRow,
} from '@/lib/messages/realtime'
import { createClient } from '@/lib/supabase/client'

export type ConversationTarget =
  | { kind: 'channel'; id: string }
  | { kind: 'dm'; id: string }

type ConversationMessagePaneProps = {
  target: ConversationTarget
  initialMessages: RealtimeMessageRow[]
  profiles: MessagePresentationProfile[]
  currentUserId: string
  isAdmin: boolean
}

export function ConversationMessagePane({
  target,
  initialMessages,
  profiles,
  currentUserId,
  isAdmin,
}: ConversationMessagePaneProps) {
  const client = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState(initialMessages)
  const [draft, setDraft] = useState('')
  const [replyToId, setReplyToId] = useState<number | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(initialMessages.length === 50)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState('connecting')

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined

    setRealtimeStatus('connecting')

    const onChange = (incoming: RealtimeMessageRow) => {
      setMessages((current) => reconcileMessageChange(current, incoming))
    }
    const onStatus = (status: string) => {
      if (active) setRealtimeStatus(status.toLowerCase())
    }

    void (async () => {
      const {
        data: { session },
        error: sessionError,
      } = await client.auth.getSession()

      if (!active) return
      if (sessionError || !session?.access_token) {
        setRealtimeStatus('auth-missing')
        return
      }

      await client.realtime.setAuth(session.access_token)
      if (!active) return

      unsubscribe =
        target.kind === 'channel'
          ? subscribeToChannelMessages(client as never, target.id, onChange, onStatus)
          : subscribeToDmMessages(client as never, target.id, onChange, onStatus)
    })()

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [client, target.id, target.kind])

  const renderedMessages = useMemo(
    () => toMessageListItems(messages, profiles),
    [messages, profiles],
  )
  const replyTarget =
    replyToId === null ? null : renderedMessages.find((message) => message.id === replyToId) ?? null
  const editingTarget =
    editingMessageId === null
      ? null
      : renderedMessages.find((message) => message.id === editingMessageId) ?? null

  const resetComposer = () => {
    setDraft('')
    setReplyToId(null)
    setEditingMessageId(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return

    setBusy(true)
    setError(null)

    try {
      const result =
        target.kind === 'channel'
          ? editingMessageId
            ? await editChannelMessageAction({
                channelId: target.id,
                messageId: editingMessageId,
                body: draft,
              })
            : await sendChannelMessageAction({
                channelId: target.id,
                body: draft,
                replyToId,
              })
          : editingMessageId
            ? await editDmMessageAction({
                dmThreadId: target.id,
                messageId: editingMessageId,
                body: draft,
              })
            : await sendDmMessageAction({
                dmThreadId: target.id,
                body: draft,
                replyToId,
              })

      const row = messageRecordToRealtimeRow(result)
      setMessages((current) => reconcileMessageChange(current, row))
      resetComposer()
    } catch {
      setError('메시지를 처리하지 못했습니다. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const handleReply = (messageId: number) => {
    setReplyToId(messageId)
    setEditingMessageId(null)
  }

  const handleEdit = (messageId: number) => {
    const message = renderedMessages.find((item) => item.id === messageId)
    if (!message || message.deletedAt) return

    setEditingMessageId(messageId)
    setReplyToId(null)
    setDraft(message.body ?? '')
  }

  const handleDelete = async (messageId: number) => {
    if (busy) return
    setBusy(true)
    setError(null)

    try {
      const result =
        target.kind === 'channel'
          ? await deleteChannelMessageAction({ channelId: target.id, messageId })
          : await deleteDmMessageAction({ dmThreadId: target.id, messageId })

      setMessages((current) =>
        reconcileMessageChange(current, messageRecordToRealtimeRow(result)),
      )
      if (replyToId === messageId) setReplyToId(null)
      if (editingMessageId === messageId) resetComposer()
    } catch {
      setError('메시지를 삭제하지 못했습니다. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const handleLoadOlder = async () => {
    const beforeId = messages[0]?.id
    if (!beforeId || busy) return

    setBusy(true)
    setError(null)

    try {
      const older =
        target.kind === 'channel'
          ? await loadOlderChannelMessagesAction({ channelId: target.id, beforeId })
          : await loadOlderDmMessagesAction({ dmThreadId: target.id, beforeId })
      const rows = older.map(messageRecordToRealtimeRow)
      setMessages((current) => mergeMessageHistory(current, rows))
      if (older.length < 50) setHasMore(false)
    } catch {
      setError('이전 메시지를 불러오지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className="flex min-h-0 flex-1 flex-col pt-4"
      data-conversation-message-pane
      data-channel-message-pane={target.kind === 'channel' ? true : undefined}
      data-dm-message-pane={target.kind === 'dm' ? true : undefined}
      data-realtime-status={realtimeStatus}
    >
      {hasMore ? (
        <div className="flex justify-center pb-2">
          <button
            type="button"
            data-load-older
            disabled={busy}
            onClick={handleLoadOlder}
            className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium text-zinc-600 disabled:opacity-50 dark:border-white/10 dark:text-zinc-300"
          >
            이전 메시지 불러오기
          </button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <MessageList
          messages={renderedMessages}
          currentUserId={currentUserId}
          isAdmin={target.kind === 'channel' && isAdmin}
          onReply={handleReply}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      <div className="border-t border-black/10 pt-3 dark:border-white/10">
        {replyTarget ? (
          <div className="mb-2 flex items-start justify-between gap-3 rounded-xl bg-zinc-100 px-3 py-2 text-xs dark:bg-zinc-900">
            <div className="min-w-0">
              <p className="font-medium">{replyTarget.sender.displayName}에게 답글</p>
              <p className="mt-0.5 truncate text-zinc-500">
                {replyTarget.deletedAt ? '삭제된 메시지입니다.' : replyTarget.body}
              </p>
            </div>
            <button type="button" onClick={() => setReplyToId(null)} className="shrink-0 text-zinc-500">
              답글 취소
            </button>
          </div>
        ) : null}

        {editingTarget ? (
          <div className="mb-2 flex items-center justify-between rounded-xl bg-zinc-100 px-3 py-2 text-xs dark:bg-zinc-900">
            <span className="font-medium">메시지 수정 중</span>
            <button type="button" onClick={resetComposer} className="text-zinc-500">
              수정 취소
            </button>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex items-end gap-2" data-message-composer>
          <label className="sr-only" htmlFor="keychats-message-input">
            메시지 입력
          </label>
          <textarea
            id="keychats-message-input"
            name="message"
            rows={2}
            maxLength={20000}
            value={draft}
            disabled={busy}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="메시지를 입력하세요"
            className="min-h-12 flex-1 resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-400 disabled:opacity-60 dark:border-white/10 dark:bg-zinc-950 dark:focus:border-zinc-600"
          />
          <button
            type="submit"
            data-send-message
            disabled={busy || draft.trim().length === 0}
            className="h-12 rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-zinc-950"
          >
            {editingMessageId ? '수정' : '전송'}
          </button>
        </form>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </div>
    </section>
  )
}
