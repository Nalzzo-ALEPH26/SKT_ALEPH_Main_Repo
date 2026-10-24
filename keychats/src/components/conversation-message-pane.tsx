'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react'

import {
  deleteChannelMessageAction,
  editChannelMessageAction,
  loadLatestChannelMessagesAction,
  loadOlderChannelMessagesAction,
  sendChannelMessageAction,
} from '@/app/(workspace)/channel/message-actions'
import {
  deleteDmMessageAction,
  editDmMessageAction,
  loadLatestDmMessagesAction,
  loadOlderDmMessagesAction,
  sendDmMessageAction,
} from '@/app/(workspace)/dm/message-actions'
import {
  loadMessageStateAction,
  markConversationReadAction,
  toggleMessagePinAction,
  toggleMessageReactionAction,
} from '@/app/(workspace)/message-state-actions'
import { MessageList } from '@/components/message-list'
import {
  loadAttachmentsForMessages,
  uploadMessageAttachments,
  type AttachmentMetadata,
} from '@/lib/files/supabase'
import { validateAttachmentFile } from '@/lib/files/validation'
import { shouldSubmitComposerKey } from '@/lib/messages/composer-keys'
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

type MessageStateSnapshot = Record<
  number,
  {
    isPinned: boolean
    reactions: Array<{
      emoji: string
      count: number
      reactedByCurrentUser: boolean
    }>
  }
>

const FILE_ACCEPT = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/zip',
  'text/plain',
  '.docx',
  '.xlsx',
  '.pptx',
].join(',')

function validationMessage(code: string) {
  if (code === 'FILE_TOO_LARGE') return '파일은 10MB 이하만 첨부할 수 있습니다.'
  if (code === 'FILE_EMPTY') return '빈 파일은 첨부할 수 없습니다.'
  if (code === 'FILE_TYPE_MISMATCH') return '파일 확장자와 형식이 일치하지 않습니다.'
  return '지원하지 않는 파일 형식입니다.'
}

function clipboardFile(file: File) {
  if (file.name.includes('.')) return file
  const extension =
    file.type === 'image/jpeg'
      ? 'jpg'
      : file.type === 'image/webp'
        ? 'webp'
        : file.type === 'image/gif'
          ? 'gif'
          : 'png'
  return new File([file], `clipboard-${Date.now()}.${extension}`, { type: file.type })
}

function mergeAttachments(current: AttachmentMetadata[], incoming: AttachmentMetadata[]) {
  const byId = new Map(current.map((attachment) => [attachment.id, attachment]))
  for (const attachment of incoming) byId.set(attachment.id, attachment)
  return [...byId.values()]
}

function payloadMessageId(payload: unknown) {
  const row = payload as { new?: { message_id?: number }; old?: { message_id?: number } }
  const value = row.new?.message_id ?? row.old?.message_id
  return typeof value === 'number' ? value : null
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
  const [messageState, setMessageState] = useState<MessageStateSnapshot>({})
  const [attachments, setAttachments] = useState<AttachmentMetadata[]>([])
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [draft, setDraft] = useState('')
  const [replyToId, setReplyToId] = useState<number | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(initialMessages.length === 50)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState('connecting')
  const messagesRef = useRef(messages)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const latestMessageId = messages.at(-1)?.id ?? null

  const refreshMessageState = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return
    const snapshot = await loadMessageStateAction({ messageIds: ids })
    setMessageState((current) => ({ ...current, ...snapshot }))
  }, [])

  const refreshAttachments = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return
    const next = await loadAttachmentsForMessages(client, ids)
    setAttachments((current) => mergeAttachments(current, next))
  }, [client])

  const syncLatestMessages = useCallback(async () => {
    const latest =
      target.kind === 'channel'
        ? await loadLatestChannelMessagesAction({ channelId: target.id })
        : await loadLatestDmMessagesAction({ dmThreadId: target.id })
    const rows = latest.map(messageRecordToRealtimeRow)
    setMessages((current) => mergeMessageHistory(current, rows))
  }, [target.id, target.kind])

  useEffect(() => {
    setMessages(initialMessages)
    setHasMore(initialMessages.length === 50)
    const ids = initialMessages.map((message) => message.id)
    if (ids.length === 0) {
      setMessageState({})
      setAttachments([])
      return
    }

    let active = true
    void Promise.all([
      loadMessageStateAction({ messageIds: ids }),
      loadAttachmentsForMessages(client, ids),
    ])
      .then(([snapshot, nextAttachments]) => {
        if (!active) return
        setMessageState(snapshot)
        setAttachments(nextAttachments)
      })
      .catch(() => {
        if (active) setError('메시지 상태를 불러오지 못했습니다.')
      })

    return () => {
      active = false
    }
  }, [client, initialMessages, target.id, target.kind])

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    setRealtimeStatus('connecting')

    const onChange = (incoming: RealtimeMessageRow) => {
      setMessages((current) => reconcileMessageChange(current, incoming))
      void refreshMessageState([incoming.id]).catch(() => undefined)
      void refreshAttachments([incoming.id]).catch(() => undefined)
    }
    const onStatus = (status: string) => {
      if (!active) return
      setRealtimeStatus(status.toLowerCase())
      if (status === 'READY') void syncLatestMessages().catch(() => undefined)
    }

    void (async () => {
      const { data: { session }, error: sessionError } = await client.auth.getSession()
      if (!active) return
      if (sessionError || !session?.access_token) {
        setRealtimeStatus('auth-missing')
        return
      }
      await client.realtime.setAuth(session.access_token)
      if (!active) return
      unsubscribe = target.kind === 'channel'
        ? subscribeToChannelMessages(client as never, target.id, onChange, onStatus)
        : subscribeToDmMessages(client as never, target.id, onChange, onStatus)
    })()

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [client, refreshAttachments, refreshMessageState, syncLatestMessages, target.id, target.kind])

  useEffect(() => {
    let active = true
    let stateChannel: ReturnType<typeof client.channel> | null = null

    const refreshStatePayload = (payload: unknown) => {
      if (!active) return
      const id = payloadMessageId(payload)
      if (id !== null) void refreshMessageState([id]).catch(() => undefined)
    }
    const refreshFilePayload = (payload: unknown) => {
      if (!active) return
      const id = payloadMessageId(payload)
      if (id !== null) void refreshAttachments([id]).catch(() => undefined)
    }

    void (async () => {
      const { data: { session } } = await client.auth.getSession()
      if (!active || !session?.access_token) return
      await client.realtime.setAuth(session.access_token)
      if (!active) return

      stateChannel = client
        .channel(`message-state:${target.kind}:${target.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, refreshStatePayload)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'message_pins' }, refreshStatePayload)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attachments' }, refreshFilePayload)
        .subscribe()
    })()

    return () => {
      active = false
      if (stateChannel) void client.removeChannel(stateChannel)
    }
  }, [client, refreshAttachments, refreshMessageState, target.id, target.kind])

  useEffect(() => {
    const sync = () => void syncLatestMessages().catch(() => undefined)
    const visibility = () => {
      if (document.visibilityState === 'visible') sync()
    }
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [syncLatestMessages])

  useEffect(() => {
    if (latestMessageId === null) return
    void markConversationReadAction({
      channelId: target.kind === 'channel' ? target.id : null,
      dmThreadId: target.kind === 'dm' ? target.id : null,
      lastReadMessageId: latestMessageId,
    }).catch(() => undefined)
  }, [latestMessageId, target.id, target.kind])

  const attachmentsByMessage = useMemo(() => {
    const grouped = new Map<number, AttachmentMetadata[]>()
    for (const attachment of attachments) {
      const current = grouped.get(attachment.messageId) ?? []
      current.push(attachment)
      grouped.set(attachment.messageId, current)
    }
    return grouped
  }, [attachments])

  const renderedMessages = useMemo(
    () => toMessageListItems(messages, profiles).map((message) => ({
      ...message,
      isPinned: messageState[message.id]?.isPinned ?? false,
      reactions: messageState[message.id]?.reactions ?? [],
      attachments: attachmentsByMessage.get(message.id) ?? [],
    })),
    [attachmentsByMessage, messages, profiles, messageState],
  )

  const replyTarget = replyToId === null ? null : renderedMessages.find((message) => message.id === replyToId) ?? null
  const editingTarget = editingMessageId === null ? null : renderedMessages.find((message) => message.id === editingMessageId) ?? null

  const resetComposer = () => {
    setDraft('')
    setReplyToId(null)
    setEditingMessageId(null)
    setSelectedFiles([])
  }

  const addFiles = (files: File[]) => {
    if (files.length === 0) return
    for (const file of files) {
      const validation = validateAttachmentFile(file)
      if (!validation.ok) {
        setError(validationMessage(validation.code))
        return
      }
    }
    setError(null)
    setSelectedFiles((current) => [...current, ...files])
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const images = Array.from(event.clipboardData.files)
      .filter((file) => file.type.startsWith('image/'))
      .map(clipboardFile)
    if (images.length === 0) return
    event.preventDefault()
    addFiles(images)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return

    const outgoingDraft = draft
    const outgoingFiles = selectedFiles
    const outgoingReplyId = replyToId
    const outgoingEditId = editingMessageId
    if (!outgoingEditId) {
      setDraft('')
      setReplyToId(null)
      setSelectedFiles([])
    }

    setBusy(true)
    setError(null)
    let createdMessageId: number | null = null

    try {
      const result = target.kind === 'channel'
        ? outgoingEditId
          ? await editChannelMessageAction({ channelId: target.id, messageId: outgoingEditId, body: outgoingDraft })
          : await sendChannelMessageAction({ channelId: target.id, body: outgoingDraft, replyToId: outgoingReplyId, attachmentCount: outgoingFiles.length })
        : outgoingEditId
          ? await editDmMessageAction({ dmThreadId: target.id, messageId: outgoingEditId, body: outgoingDraft })
          : await sendDmMessageAction({ dmThreadId: target.id, body: outgoingDraft, replyToId: outgoingReplyId, attachmentCount: outgoingFiles.length })

      createdMessageId = result.id
      setMessages((current) => reconcileMessageChange(current, messageRecordToRealtimeRow(result)))

      if (!outgoingEditId && outgoingFiles.length > 0) {
        const uploaded = await uploadMessageAttachments(client, {
          userId: currentUserId,
          messageId: result.id,
          files: outgoingFiles,
        })
        setAttachments((current) => mergeAttachments(current, uploaded))
      }

      if (outgoingEditId) resetComposer()
    } catch {
      if (!outgoingEditId && draft.length === 0) setDraft(outgoingDraft)
      if (!outgoingEditId && selectedFiles.length === 0) setSelectedFiles(outgoingFiles)
      if (!outgoingEditId && replyToId === null) setReplyToId(outgoingReplyId)
      if (!outgoingEditId && createdMessageId !== null) {
        try {
          const deleted = target.kind === 'channel'
            ? await deleteChannelMessageAction({ channelId: target.id, messageId: createdMessageId })
            : await deleteDmMessageAction({ dmThreadId: target.id, messageId: createdMessageId })
          setMessages((current) => reconcileMessageChange(current, messageRecordToRealtimeRow(deleted)))
        } catch {
          // RLS keeps incomplete attachment state private.
        }
      }
      setError('메시지 또는 파일을 처리하지 못했습니다. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!shouldSubmitComposerKey({
      key: event.key,
      shiftKey: event.shiftKey,
      isComposing: event.nativeEvent.isComposing,
    })) return
    event.preventDefault()
    if (!busy) event.currentTarget.form?.requestSubmit()
  }

  const handleEdit = (messageId: number) => {
    const message = renderedMessages.find((item) => item.id === messageId)
    if (!message || message.deletedAt) return
    setEditingMessageId(messageId)
    setReplyToId(null)
    setSelectedFiles([])
    setDraft(message.body ?? '')
  }

  const handleDelete = async (messageId: number) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const result = target.kind === 'channel'
        ? await deleteChannelMessageAction({ channelId: target.id, messageId })
        : await deleteDmMessageAction({ dmThreadId: target.id, messageId })
      setMessages((current) => reconcileMessageChange(current, messageRecordToRealtimeRow(result)))
      if (replyToId === messageId) setReplyToId(null)
      if (editingMessageId === messageId) resetComposer()
    } catch {
      setError('메시지를 삭제하지 못했습니다. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const handleToggleReaction = async (messageId: number, emoji: string) => {
    setError(null)
    try {
      await toggleMessageReactionAction({ messageId, emoji })
      await refreshMessageState([messageId])
    } catch {
      setError('반응을 변경하지 못했습니다.')
    }
  }

  const handleTogglePin = async (messageId: number) => {
    setError(null)
    try {
      await toggleMessagePinAction({ messageId })
      await refreshMessageState([messageId])
    } catch {
      setError('고정 상태를 변경하지 못했습니다.')
    }
  }

  const handleLoadOlder = async () => {
    const beforeId = messagesRef.current[0]?.id
    if (!beforeId || busy) return
    setBusy(true)
    setError(null)
    try {
      const older = target.kind === 'channel'
        ? await loadOlderChannelMessagesAction({ channelId: target.id, beforeId })
        : await loadOlderDmMessagesAction({ dmThreadId: target.id, beforeId })
      const rows = older.map(messageRecordToRealtimeRow)
      setMessages((current) => mergeMessageHistory(current, rows))
      const olderIds = rows.map((row) => row.id)
      void refreshMessageState(olderIds).catch(() => undefined)
      void refreshAttachments(olderIds).catch(() => undefined)
      if (older.length < 50) setHasMore(false)
    } catch {
      setError('이전 메시지를 불러오지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className="flex min-h-0 flex-1 flex-col pt-3"
      data-conversation-message-pane
      data-channel-message-pane={target.kind === 'channel' ? true : undefined}
      data-dm-message-pane={target.kind === 'dm' ? true : undefined}
      data-realtime-status={realtimeStatus}
    >
      {hasMore ? (
        <div className="flex shrink-0 justify-center pb-2">
          <button type="button" data-load-older disabled={busy} onClick={handleLoadOlder} className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium text-zinc-600 disabled:opacity-50 dark:border-white/10 dark:text-zinc-300">
            이전 메시지 불러오기
          </button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <MessageList
          messages={renderedMessages}
          currentUserId={currentUserId}
          isAdmin={target.kind === 'channel' && isAdmin}
          onReply={(messageId) => { setReplyToId(messageId); setEditingMessageId(null) }}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleReaction={handleToggleReaction}
          onTogglePin={handleTogglePin}
        />
      </div>

      <div data-sticky-composer className="sticky bottom-0 z-10 shrink-0 border-t border-black/20 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 dark:border-white/15 dark:bg-[#111111]">
        {replyTarget ? (
          <div className="mb-2 flex items-start justify-between gap-3 rounded-xl bg-zinc-100 px-3 py-2 text-xs dark:bg-zinc-900">
            <div className="min-w-0"><p className="font-medium">{replyTarget.sender.displayName}에게 답글</p><p className="mt-0.5 truncate text-zinc-500">{replyTarget.deletedAt ? '삭제된 메시지입니다.' : replyTarget.body}</p></div>
            <button type="button" onClick={() => setReplyToId(null)} className="shrink-0 text-zinc-500">답글 취소</button>
          </div>
        ) : null}
        {editingTarget ? (
          <div className="mb-2 flex items-center justify-between rounded-xl bg-zinc-100 px-3 py-2 text-xs dark:bg-zinc-900">
            <span className="font-medium">메시지 수정 중</span><button type="button" onClick={resetComposer} className="text-zinc-500">수정 취소</button>
          </div>
        ) : null}
        {!editingTarget && selectedFiles.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2" data-selected-attachments>
            {selectedFiles.map((file, index) => (
              <span key={`${file.name}-${file.size}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 text-xs dark:bg-zinc-900">
                <span className="max-w-48 truncate">{file.name}</span>
                <button type="button" aria-label={`${file.name} 첨부 취소`} onClick={() => setSelectedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} className="text-zinc-500">×</button>
              </span>
            ))}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex items-end gap-2" data-message-composer>
          {!editingTarget ? (
            <label className="flex h-12 cursor-pointer items-center rounded-2xl border border-black/30 bg-white px-3 text-sm text-black dark:border-white/20 dark:bg-[#111111] dark:text-white">
              첨부
              <input type="file" multiple accept={FILE_ACCEPT} className="sr-only" disabled={busy} onChange={handleFileChange} />
            </label>
          ) : null}
          <label className="sr-only" htmlFor="keychats-message-input">메시지 입력</label>
          <textarea
            id="keychats-message-input"
            name="message"
            rows={2}
            maxLength={20000}
            value={draft}
            onPaste={handlePaste}
            onKeyDown={handleComposerKeyDown}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="메시지를 입력하세요 · Shift+Enter 줄바꿈"
            className="min-h-12 flex-1 resize-none rounded-2xl border border-black bg-white px-4 py-3 text-sm text-black outline-none focus:ring-2 focus:ring-black/10 dark:border-white/30 dark:bg-zinc-950 dark:text-white dark:focus:ring-white/10"
          />
          <button type="submit" data-send-message disabled={busy || (draft.trim().length === 0 && selectedFiles.length === 0)} className="h-12 rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-zinc-950">
            {editingMessageId ? '수정' : busy ? '전송 중…' : '전송'}
          </button>
        </form>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </div>
    </section>
  )
}
