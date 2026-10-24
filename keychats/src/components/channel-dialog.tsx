'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'

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
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 8, top: 8 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || variant !== 'sidebar') return

    const updatePosition = () => {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const width = 288
      const gap = 8
      const edge = 8
      let left = rect.right + gap
      if (left + width > window.innerWidth - edge) {
        left = Math.max(edge, rect.left - width - gap)
      }
      const estimatedHeight = Math.min(480, window.innerHeight - edge * 2)
      const top = Math.min(Math.max(edge, rect.top), Math.max(edge, window.innerHeight - estimatedHeight - edge))
      setPosition({ left, top })
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, variant])

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

  const sidebar = variant === 'sidebar'
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
          className={sidebar
            ? 'w-full rounded-lg border border-[#fff0c9]/25 bg-[#1d327a] px-3 py-2 text-[#fff0c9] outline-none placeholder:text-[#fff0c9]/35 disabled:opacity-60'
            : 'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-black outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white'}
        />
      </label>
      {candidates.length > 0 ? (
        <fieldset className="max-h-48 space-y-2 overflow-y-auto" disabled={busy}>
          <legend className="text-sm font-medium">초대할 멤버</legend>
          {candidates.map((profile) => (
            <label key={profile.userId} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="memberIds" value={profile.userId} />
              <span>{profile.displayName}</span>
              <span data-identity-font="true" className={sidebar ? 'text-[#fff0c9]/60' : 'text-zinc-500'}>@{profile.username}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {error ? <p role="alert" className={sidebar ? 'text-sm text-red-200' : 'text-sm text-red-600 dark:text-red-400'}>{error}</p> : null}
      <button
        type="submit"
        disabled={busy || !action}
        className={sidebar
          ? 'rounded-lg bg-[#fff0c9] px-3 py-2 text-sm font-semibold text-[#243b8f] disabled:opacity-50'
          : 'rounded-lg bg-zinc-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-950'}
      >
        {busy ? '만드는 중…' : '만들기'}
      </button>
    </form>
  )

  if (sidebar) {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          data-channel-create-trigger={true}
          data-popover-side="right"
          aria-label="채널 만들기"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="rounded-md px-1.5 text-lg leading-none opacity-60 hover:opacity-100"
        >
          +
        </button>
        {open && typeof document !== 'undefined'
          ? createPortal(
              <div
                ref={popoverRef}
                data-channel-create-popover={true}
                className="fixed z-[80] w-72 max-w-[calc(100vw-16px)] rounded-xl border border-[#fff0c9]/20 bg-[#243b8f] p-4 text-[#fff0c9] shadow-xl"
                style={{ left: position.left, top: position.top }}
              >
                <div className="mb-3 flex items-center justify-between gap-3 text-sm font-semibold">
                  <span>새 채널</span>
                  <button type="button" onClick={() => setOpen(false)} aria-label="채널 만들기 닫기" className="text-lg font-normal leading-none opacity-50 hover:opacity-100">×</button>
                </div>
                {form}
              </div>,
              document.body,
            )
          : null}
      </>
    )
  }

  return (
    <details className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <summary className="cursor-pointer text-sm font-semibold">채널 만들기</summary>
      <div className="mt-4">{form}</div>
    </details>
  )
}
