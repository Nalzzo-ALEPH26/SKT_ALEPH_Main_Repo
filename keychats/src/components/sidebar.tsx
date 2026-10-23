'use client'

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'

import {
  createChannelAction,
  joinChannelByCodeAction,
  manageChannelsAction,
} from '@/app/(workspace)/channel/channel-actions'
import {
  createCommunityAction,
  deleteCommunitiesAction,
} from '@/app/(workspace)/community/community-actions'
import {
  manageDirectMessagesAction,
  startDirectMessageAction,
} from '@/app/(workspace)/dm/dm-actions'
import { Avatar } from '@/components/avatar'
import { ChannelDialog } from '@/components/channel-dialog'
import type { KeychatsTheme } from '@/lib/settings/theme'

type ChannelItem = {
  id: string
  name: string
  unreadCount: number
  canLeave?: boolean
  canDelete?: boolean
}

type DirectItem = {
  id: string
  displayName: string
  unreadCount: number
}

type DirectCandidate = {
  userId: string
  displayName: string
}

type ChannelProfile = {
  userId: string
  displayName: string
  username: string
}

type CommunityItem = {
  id: string
  name: string
}

type SidebarProps = {
  profile: {
    displayName: string
    avatarPath: string | null
  }
  currentUserId?: string
  channelProfiles?: ChannelProfile[]
  channels: ChannelItem[]
  directMessages: DirectItem[]
  directCandidates?: DirectCandidate[]
  communities?: CommunityItem[]
  theme?: KeychatsTheme
  isAdmin?: boolean
  unreadRealtimeStatus?: string
}

type ViewportPopoverProps = {
  label: ReactNode
  marker: string
  dark: boolean
  width?: number
  children: ReactNode
  ariaLabel?: string
  triggerClassName?: string
}

function ViewportPopover({
  label,
  marker,
  dark,
  width = 256,
  children,
  ariaLabel,
  triggerClassName = '',
}: ViewportPopoverProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 8, top: 8 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const trigger = triggerRef.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const edge = 8
      const gap = 8
      const maxWidth = Math.min(width, window.innerWidth - edge * 2)
      let left = rect.right + gap

      if (left + maxWidth > window.innerWidth - edge) {
        left = rect.left - maxWidth - gap
      }
      if (left < edge) {
        left = Math.min(
          Math.max(edge, rect.left),
          Math.max(edge, window.innerWidth - maxWidth - edge),
        )
      }

      const estimatedHeight = Math.min(420, window.innerHeight - edge * 2)
      const top = Math.min(
        Math.max(edge, rect.top),
        Math.max(edge, window.innerHeight - estimatedHeight - edge),
      )

      setPosition({ left, top })
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
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
  }, [open, width])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-sidebar-popover-trigger={marker}
        data-popover-layout="viewport-safe"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={triggerClassName}
      >
        {label}
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              data-sidebar-popover={marker}
              data-popover-layout="viewport-safe"
              className={`fixed z-[90] max-h-[calc(100vh-16px)] overflow-y-auto rounded-xl border p-3 text-left shadow-xl ${
                dark ? 'border-white/10 bg-[#202020] text-white' : 'border-black/10 bg-white text-black'
              }`}
              style={{ left: position.left, top: position.top, width: Math.min(width, window.innerWidth - 16) }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

type SelectionFormItem = {
  id: string
  label: string
}

type SelectionFormProps = {
  action: (formData: FormData) => void | Promise<void>
  items: SelectionFormItem[]
  fieldName: string
  title: string
  submitLabel: string
  dark: boolean
  operation?: 'leave' | 'delete'
  destructive?: boolean
  rowKind?: 'dm' | 'channel' | 'community'
  className?: string
}

function SelectionForm({
  action,
  items,
  fieldName,
  title,
  submitLabel,
  dark,
  operation,
  destructive = false,
  rowKind,
  className = '',
}: SelectionFormProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (selectedIds.size === 0) event.preventDefault()
  }

  const setSelected = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return (
    <form action={action} onSubmit={onSubmit} className={`space-y-2 ${className}`}>
      {operation ? <input type="hidden" name="operation" value={operation} /> : null}
      <p className="text-xs font-semibold tracking-normal">{title}</p>
      <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
        {items.map((entry) => {
          const selected = selectedIds.has(entry.id)
          return (
            <label
              key={entry.id}
              data-dm-management-row={rowKind === 'dm' ? 'true' : undefined}
              data-channel-management-row={rowKind === 'channel' ? 'true' : undefined}
              data-community-management-row={rowKind === 'community' ? 'true' : undefined}
              data-selected={selected ? 'true' : 'false'}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 text-xs font-normal tracking-normal transition ${
                selected
                  ? dark
                    ? 'border-white/25 bg-white/10 text-white'
                    : 'border-black/15 bg-black/[0.07] text-black'
                  : dark
                    ? 'border-transparent text-white/75 hover:bg-white/5'
                    : 'border-transparent text-black/70 hover:bg-black/[0.03]'
              }`}
            >
              <input
                type="checkbox"
                name={fieldName}
                value={entry.id}
                checked={selected}
                onChange={(event) => setSelected(entry.id, event.target.checked)}
              />
              <span className="min-w-0 truncate">{entry.label}</span>
            </label>
          )
        })}
      </div>
      <button
        type="submit"
        disabled={selectedIds.size === 0}
        className={`w-full rounded-lg border px-2 py-1.5 text-xs font-semibold tracking-normal disabled:cursor-not-allowed disabled:opacity-40 ${
          destructive
            ? 'border-red-500/30 text-red-600 hover:bg-red-500/5 dark:text-red-400'
            : dark
              ? 'border-white/15 hover:bg-white/5'
              : 'border-black/10 hover:bg-black/5'
        }`}
      >
        {submitLabel}
      </button>
    </form>
  )
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      data-unread-badge
      className="min-w-5 rounded-full bg-black px-1.5 py-0.5 text-center text-xs font-semibold text-white dark:bg-white dark:text-black"
    >
      {count}
    </span>
  )
}

export function Sidebar({
  profile,
  currentUserId = '',
  channelProfiles = [],
  channels,
  directMessages,
  directCandidates = [],
  communities = [],
  theme = 'light',
  isAdmin = false,
  unreadRealtimeStatus = 'connecting',
}: SidebarProps) {
  const dark = theme === 'dark'
  const muted = dark ? 'text-white/45' : 'text-black/40'
  const item = dark ? 'text-white/75 hover:bg-white/5' : 'text-black/70 hover:bg-black/5'
  const smallControl = `rounded-md px-1.5 py-1 text-[11px] tracking-normal ${
    dark ? 'text-white/60 hover:bg-white/5' : 'text-black/55 hover:bg-black/5'
  }`
  const manageableLeaveChannels = channels.filter((channel) => channel.canLeave)
  const manageableDeleteChannels = channels.filter((channel) => channel.canDelete)

  return (
    <aside
      data-unread-realtime-status={unreadRealtimeStatus}
      className={`flex h-full w-full flex-col border-r p-4 md:w-72 ${
        dark ? 'border-white/10 bg-[#181818] text-white' : 'border-black/10 bg-[#f7f7f5] text-black'
      }`}
    >
      <div className={`px-2 pb-5 pt-2 text-sm font-semibold tracking-[0.18em] ${dark ? 'text-white/75' : 'text-black/70'}`}>
        KEYCHATS
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto">
        <section>
          <div className={`mb-2 flex items-center justify-between px-2 text-xs font-semibold tracking-[0.14em] ${muted}`}>
            <span>CHANNELS</span>
            <div className="flex items-center gap-1.5">
              {(manageableLeaveChannels.length > 0 || manageableDeleteChannels.length > 0) ? (
                <ViewportPopover
                  label="채널 관리"
                  marker="channel-management"
                  dark={dark}
                  width={256}
                  triggerClassName={smallControl}
                >
                  {manageableLeaveChannels.length > 0 ? (
                    <SelectionForm
                      action={manageChannelsAction}
                      items={manageableLeaveChannels.map((channel) => ({ id: channel.id, label: `#${channel.name}` }))}
                      fieldName="channelIds"
                      title="나갈 채널 선택"
                      submitLabel="선택한 채널 나가기"
                      operation="leave"
                      dark={dark}
                      rowKind="channel"
                    />
                  ) : null}

                  {manageableDeleteChannels.length > 0 ? (
                    <SelectionForm
                      action={manageChannelsAction}
                      items={manageableDeleteChannels.map((channel) => ({ id: channel.id, label: `#${channel.name}` }))}
                      fieldName="channelIds"
                      title="삭제할 채널 선택"
                      submitLabel="선택한 채널 삭제"
                      operation="delete"
                      dark={dark}
                      destructive
                      rowKind="channel"
                      className={`${manageableLeaveChannels.length > 0 ? 'mt-3 border-t pt-3' : ''} ${dark ? 'border-white/10' : 'border-black/10'}`}
                    />
                  ) : null}
                </ViewportPopover>
              ) : null}
              <ChannelDialog
                variant="sidebar"
                profiles={channelProfiles}
                currentUserId={currentUserId}
                action={createChannelAction}
              />
            </div>
          </div>
          <div className="space-y-1">
            {channels.map((channel) => (
              <Link
                key={channel.id}
                href={`/channel/${channel.id}`}
                className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-sm ${item}`}
              >
                <span>#{channel.name}</span>
                <UnreadBadge count={channel.unreadCount} />
              </Link>
            ))}
          </div>
          <form action={joinChannelByCodeAction} className="mt-3 flex gap-1.5 px-2">
            <input
              name="joinCode"
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="100000 · General"
              aria-label="채널 입장 코드"
              className={`min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-xs outline-none ${
                dark
                  ? 'border-white/10 bg-white/5 text-white placeholder:text-white/30'
                  : 'border-black/10 bg-white text-black placeholder:text-black/30'
              }`}
            />
            <button type="submit" className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${dark ? 'border-white/10' : 'border-black/10'}`}>
              입장
            </button>
          </form>
        </section>

        <section>
          <div className={`mb-2 flex items-center justify-between px-2 text-xs font-semibold tracking-[0.14em] ${muted}`}>
            <span>DIRECT</span>
            <div className="flex items-center gap-1.5">
              {directMessages.length > 0 ? (
                <ViewportPopover
                  label="DM 관리"
                  marker="dm-management"
                  dark={dark}
                  width={256}
                  triggerClassName={smallControl}
                >
                  <SelectionForm
                    action={manageDirectMessagesAction}
                    items={directMessages.map((direct) => ({ id: direct.id, label: direct.displayName }))}
                    fieldName="dmThreadIds"
                    title="나갈 DM 선택"
                    submitLabel="선택한 DM 나가기"
                    dark={dark}
                    rowKind="dm"
                  />
                </ViewportPopover>
              ) : null}
              {directCandidates.length > 0 ? (
                <ViewportPopover
                  label="새 DM"
                  marker="new-dm"
                  dark={dark}
                  width={224}
                  triggerClassName={smallControl}
                >
                  <div className="max-h-72 overflow-y-auto">
                    {directCandidates.map((candidate) => (
                      <form key={candidate.userId} action={startDirectMessageAction}>
                        <input type="hidden" name="otherUserId" value={candidate.userId} />
                        <button type="submit" className={`w-full truncate rounded-lg px-2.5 py-2 text-left text-sm ${item}`}>
                          {candidate.displayName}
                        </button>
                      </form>
                    ))}
                  </div>
                </ViewportPopover>
              ) : null}
            </div>
          </div>
          <div className="space-y-1">
            {directMessages.map((direct) => (
              <Link key={direct.id} href={`/dm/${direct.id}`} className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-sm ${item}`}>
                <span className="min-w-0 truncate">{direct.displayName}</span>
                <UnreadBadge count={direct.unreadCount} />
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className={`mb-2 flex items-center justify-between px-2 text-xs font-semibold tracking-[0.14em] ${muted}`}>
            <span>COMMUNITY</span>
            <div className="flex items-center gap-1.5">
              {isAdmin && communities.length > 0 ? (
                <ViewportPopover
                  label="커뮤니티 관리"
                  marker="community-management"
                  dark={dark}
                  width={256}
                  triggerClassName={smallControl}
                >
                  <SelectionForm
                    action={deleteCommunitiesAction}
                    items={communities.map((community) => ({ id: community.id, label: community.name }))}
                    fieldName="communityIds"
                    title="삭제할 커뮤니티 선택"
                    submitLabel="선택한 커뮤니티 삭제"
                    dark={dark}
                    destructive
                    rowKind="community"
                  />
                </ViewportPopover>
              ) : null}
              <ViewportPopover
                label="+"
                marker="new-community"
                dark={dark}
                width={256}
                ariaLabel="커뮤니티 추가"
                triggerClassName="rounded-md px-1.5 text-lg leading-none opacity-60 hover:opacity-100"
              >
                <form action={createCommunityAction} className="space-y-3">
                  <label className="block space-y-1 text-xs font-semibold tracking-normal">
                    <span>새 커뮤니티 이름</span>
                    <input
                      name="communityName"
                      required
                      maxLength={40}
                      placeholder="예: 자유게시판"
                      className={`w-full rounded-lg border px-2.5 py-2 text-sm font-normal outline-none ${
                        dark
                          ? 'border-white/10 bg-black/20 text-white placeholder:text-white/30'
                          : 'border-black/10 bg-white text-black placeholder:text-black/30'
                      }`}
                    />
                  </label>
                  <button type="submit" className={`w-full rounded-lg border px-2 py-1.5 text-xs font-semibold tracking-normal ${dark ? 'border-white/15 hover:bg-white/5' : 'border-black/10 hover:bg-black/5'}`}>
                    추가
                  </button>
                </form>
              </ViewportPopover>
            </div>
          </div>
          <div className="space-y-1">
            <Link href="/feedback" className={`block rounded-lg px-2.5 py-2 text-sm ${item}`}>
              피드백
            </Link>
            {communities.map((community) => (
              <Link key={community.id} href={`/community/${community.id}`} className={`block truncate rounded-lg px-2.5 py-2 text-sm ${item}`}>
                {community.name}
              </Link>
            ))}
          </div>
        </section>

        {isAdmin ? (
          <section>
            <div className={`mb-2 px-2 text-xs font-semibold tracking-[0.14em] ${muted}`}>ADMIN</div>
            <Link href="/admin" className={`block rounded-lg px-2.5 py-2 text-sm ${item}`}>
              관리자
            </Link>
          </section>
        ) : null}
      </nav>

      <Link href="/settings" className={`mt-4 flex items-center gap-3 rounded-xl border p-3 ${dark ? 'border-white/10 bg-white/5' : 'border-black/5 bg-white'}`}>
        <Avatar displayName={profile.displayName} avatarPath={profile.avatarPath} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{profile.displayName}</span>
      </Link>
    </aside>
  )
}
