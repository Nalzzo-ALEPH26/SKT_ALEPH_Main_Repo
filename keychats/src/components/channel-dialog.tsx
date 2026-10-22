'use client'

import { useState, type FormEvent } from 'react'

type ProfileOption = {
  userId: string
  displayName: string
  username: string
}

type ChannelDialogProps = {
  profiles: ProfileOption[]
  currentUserId: string
  action?: (formData: FormData) => Promise<{ channelId: string } | void>
  variant?: 'card' | 'sidebar'
}

function lockCurrentConversationForNavigation() {
  const pane = document.querySelector<HTMLElement>('[data-conversation-message-pane]')
  if (!pane) return
  pane.setAttribute('data-realtime-status', 'connecting')
}

export function ChannelDialog({
  profiles,
  currentUserId,
  action,
  variant = 'card',
}: ChannelDialogProps) {
  const candidates = profiles.filter((profile) => profile.userId !== currentUserId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!action || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await action(new FormData(event.currentTarget))
      if (result?.channelId) {
        lockCurrentConversationForNavigation()
        window.location.assign(`/chats/channel/${result.channelId}`)
        return
      }
      setError('채널을 만들지 못했습니다. 다시 시도해 주세요.')
    } catch {
      setError('채널을 만들지 못했습니다. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">채널 이름</span>
        <input
          name="name"
          required
          maxLength={80}
          placeholder="예: 개발"
          disabled={busy}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-black outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
        />
      </label>
      {candidates.length > 0 ? (
        <fieldset className="max-h-48 space-y-2 overflow-y-auto" disabled={busy}>
          <legend className="text-sm font-medium">초대할 멤버</legend>
          {candidates.map((profile) => (
            <label key={profile.userId} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="memberIds" value={profile.userId} />
              <span>{profile.displayName}</span>
              <span className="text-zinc-500">@{profile.username}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={busy || !action}
        className="rounded-lg bg-zinc-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-950"
      >
        {busy ? '만드는 중…' : '만들기'}
      </button>
    </form>
  )

  if (variant === 'sidebar') {
    return (
      <details className="relative">
        <summary
          data-channel-create-trigger={true}
          aria-label="채널 만들기"
          className="cursor-pointer list-none rounded-md px-1.5 text-lg leading-none opacity-60 hover:opacity-100"
        >
          +
        </summary>
        <div className="absolute right-0 top-7 z-30 w-72 rounded-xl border border-black/10 bg-white p-4 text-black shadow-xl dark:border-white/10 dark:bg-[#202020] dark:text-white">
          <div className="mb-3 text-sm font-semibold">채널 만들기</div>
          {form}
        </div>
      </details>
    )
  }

  return (
    <details className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <summary className="cursor-pointer text-sm font-semibold">채널 만들기</summary>
      <div className="mt-4">{form}</div>
    </details>
  )
}
