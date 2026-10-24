'use client'

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
import { isSidebarHrefActive, sortSidebarCommunities, type SidebarCommunity } from '@/lib/sidebar/presentation'
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

type CommunityItem = SidebarCommunity

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
  width?: number
  children: ReactNode
  ariaLabel?: string
  triggerClassName?: string
}

function ViewportPopover({
  label,
  marker,
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

      if (left + maxWidth > window.innerWidth - edge) left = rect.left - maxWidth - gap
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
              className="fixed z-[90] max-h-[calc(100vh-16px)] overflow-y-auto rounded-xl border border-[#fff0c9]/20 bg-[#243b8f] p-3 text-left text-[#fff0c9] shadow-xl"
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
  operation?: 'leave' | 'delete' | 'pin' | 'unpin'
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
                  ? 'border-[#fff0c9]/50 bg-[#fff0c9] text-[#243b8f]'
                  : 'border-transparent text-[#fff0c9]/80 hover:bg-[#fff0c9]/10'
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
            ? 'border-red-300/50 text-red-200 hover:bg-red-500/10'
            : 'border-[#fff0c9]/25 text-[#fff0c9] hover:bg-[#fff0c9]/10'
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
      className="min-w-5 rounded-full bg-[#fff0c9] px-1.5 py-0.5 text-center text-xs font-semibold text-[#243b8f]"
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
  theme: _theme = 'light',
  isAdmin = false,
  unreadRealtimeStatus = 'connecting',
}: SidebarProps) {
  const pathname = usePathname()
  const muted = 'text-[#fff0c9]/50'
  const item = 'text-[#fff0c9]/80 hover:bg-[#fff0c9]/10 hover:text-[#fff0c9]'
  const activeItem = 'bg-[#1d327a] text-[#fff0c9] font-semibold shadow-sm'
  const smallControl = 'rounded-md px-1.5 py-1 text-[11px] tracking-normal text-[#fff0c9]/65 hover:bg-[#fff0c9]/10 hover:text-[#fff0c9]'
  const manageableLeaveChannels = channels.filter((channel) => channel.canLeave)
  const manageableDeleteChannels = channels.filter((channel) => channel.canDelete)
  const orderedCommunities = sortSidebarCommunities(communities)
  const pinnedCommunities = orderedCommunities.filter((community) => Boolean(community.pinnedAt))
  const linkClass = (href: string) =>
    `block rounded-lg px-2.5 py-2 text-sm transition ${isSidebarHrefActive(pathname, href) ? activeItem : item}`
  const rowLinkClass = (href: string) =>
    `flex items-center justify-between rounded-lg px-2.5 py-2 text-sm transition ${isSidebarHrefActive(pathname, href) ? activeItem : item}`

  return (
    <aside
      data-sidebar-root
      data-unread-realtime-status={unreadRealtimeStatus}
      className="flex h-full w-full flex-col border-r border-[#fff0c9]/20 bg-[#243b8f] p-4 text-[#fff0c9] md:w-72"
    >
      <div className="px-2 pb-5 pt-2 text-sm font-semibold tracking-[0.18em] text-[#fff0c9]/90">
        KEYCHATS
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto">
        <section>
          <div className={`mb-2 flex items-center justify-between px-2 text-xs font-semibold tracking-[0.14em] ${muted}`}>
            <span>CHANNELS</span>
            <div className="flex items-center gap-1.5">
              {manageableLeaveChannels.length > 0 || manageableDeleteChannels.length > 0 ? (
                <ViewportPopover label="채널 관리" marker="channel-management" width={256} triggerClassName={smallControl}>
                  {manageableLeaveChannels.length > 0 ? (
                    <SelectionForm
                      action={manageChannelsAction}
                      items={manageableLeaveChannels.map((channel) => ({ id: channel.id, label: `#${channel.name}` }))}
                      fieldName="channelIds"
                      title="나갈 채널 선택"
                      submitLabel="선택한 채널 나가기"
                      operation="leave"
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
                      destructive
                      rowKind="channel"
                      className={manageableLeaveChannels.length > 0 ? 'mt-3 border-t border-[#fff0c9]/20 pt-3' : ''}
                    />
                  ) : null}
                </ViewportPopover>
              ) : null}
              <ChannelDialog variant="sidebar" profiles={channelProfiles} currentUserId={currentUserId} action={createChannelAction} />
            </div>
          </div>
          <div className="space-y-1">
            {channels.map((channel) => {
              const href = `/channel/${channel.id}`
              return (
                <Link key={channel.id} href={href} data-sidebar-active={isSidebarHrefActive(pathname, href) ? 'true' : 'false'} className={rowLinkClass(href)}>
                  <span>#{channel.name}</span>
                  <UnreadBadge count={channel.unreadCount} />
                </Link>
              )
            })}
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
              className="min-w-0 flex-1 rounded-lg border border-[#fff0c9]/25 bg-[#1d327a] px-2 py-1.5 text-xs text-[#fff0c9] outline-none placeholder:text-[#fff0c9]/35"
            />
            <button type="submit" className="rounded-lg border border-[#fff0c9]/25 px-2 py-1.5 text-xs font-semibold hover:bg-[#fff0c9]/10">
              입장
            </button>
          </form>
        </section>

        <section>
          <div className={`mb-2 flex items-center justify-between px-2 text-xs font-semibold tracking-[0.14em] ${muted}`}>
            <span>DIRECT</span>
            <div className="flex items-center gap-1.5">
              {directMessages.length > 0 ? (
                <ViewportPopover label="DM 관리" marker="dm-management" width={256} triggerClassName={smallControl}>
                  <SelectionForm
                    action={manageDirectMessagesAction}
                    items={directMessages.map((direct) => ({ id: direct.id, label: direct.displayName }))}
                    fieldName="dmThreadIds"
                    title="나갈 DM 선택"
                    submitLabel="선택한 DM 나가기"
                    rowKind="dm"
                  />
                </ViewportPopover>
              ) : null}
              {directCandidates.length > 0 ? (
                <ViewportPopover label="새 DM" marker="new-dm" width={224} triggerClassName={smallControl}>
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
            {directMessages.map((direct) => {
              const href = `/dm/${direct.id}`
              return (
                <Link key={direct.id} href={href} data-sidebar-active={isSidebarHrefActive(pathname, href) ? 'true' : 'false'} className={rowLinkClass(href)}>
                  <span className="min-w-0 truncate">{direct.displayName}</span>
                  <UnreadBadge count={direct.unreadCount} />
                </Link>
              )
            })}
          </div>
        </section>

        <section>
          <div className={`mb-2 flex items-center justify-between px-2 text-xs font-semibold tracking-[0.14em] ${muted}`}>
            <span>COMMUNITY</span>
            <div className="flex items-center gap-1.5">
              {isAdmin && orderedCommunities.length > 0 ? (
                <ViewportPopover label="커뮤니티 관리" marker="community-management" width={280} triggerClassName={smallControl}>
                  <SelectionForm
                    action={deleteCommunitiesAction}
                    items={orderedCommunities.map((community) => ({ id: community.id, label: community.name }))}
                    fieldName="communityIds"
                    title="상단 고정할 커뮤니티 선택"
                    submitLabel="선택한 커뮤니티 상단 고정"
                    operation="pin"
                    rowKind="community"
                  />
                  {pinnedCommunities.length > 0 ? (
                    <SelectionForm
                      action={deleteCommunitiesAction}
                      items={pinnedCommunities.map((community) => ({ id: community.id, label: community.name }))}
                      fieldName="communityIds"
                      title="고정 해제할 커뮤니티 선택"
                      submitLabel="선택한 커뮤니티 고정 해제"
                      operation="unpin"
                      rowKind="community"
                      className="mt-3 border-t border-[#fff0c9]/20 pt-3"
                    />
                  ) : null}
                  <SelectionForm
                    action={deleteCommunitiesAction}
                    items={orderedCommunities.map((community) => ({ id: community.id, label: community.name }))}
                    fieldName="communityIds"
                    title="삭제할 커뮤니티 선택"
                    submitLabel="선택한 커뮤니티 삭제"
                    operation="delete"
                    destructive
                    rowKind="community"
                    className="mt-3 border-t border-[#fff0c9]/20 pt-3"
                  />
                </ViewportPopover>
              ) : null}
              <ViewportPopover
                label="+"
                marker="new-community"
                width={256}
                ariaLabel="커뮤니티 추가"
                triggerClassName="rounded-md px-1.5 text-lg leading-none text-[#fff0c9]/65 hover:bg-[#fff0c9]/10 hover:text-[#fff0c9]"
              >
                <form action={createCommunityAction} className="space-y-3">
                  <label className="block space-y-1 text-xs font-semibold tracking-normal">
                    <span>새 커뮤니티 이름</span>
                    <input
                      name="communityName"
                      required
                      maxLength={40}
                      placeholder="예: 자유게시판"
                      className="w-full rounded-lg border border-[#fff0c9]/25 bg-[#1d327a] px-2.5 py-2 text-sm font-normal text-[#fff0c9] outline-none placeholder:text-[#fff0c9]/35"
                    />
                  </label>
                  <button type="submit" className="w-full rounded-lg border border-[#fff0c9]/25 px-2 py-1.5 text-xs font-semibold tracking-normal hover:bg-[#fff0c9]/10">
                    추가
                  </button>
                </form>
              </ViewportPopover>
            </div>
          </div>
          <div className="space-y-1">
            <Link href="/feedback" data-sidebar-active={isSidebarHrefActive(pathname, '/feedback') ? 'true' : 'false'} className={linkClass('/feedback')}>
              피드백
            </Link>
            {orderedCommunities.map((community) => {
              const href = `/community/${community.id}`
              const active = isSidebarHrefActive(pathname, href)
              return (
                <Link key={community.id} href={href} data-sidebar-active={active ? 'true' : 'false'} className={linkClass(href)}>
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 truncate">{community.name}</span>
                    {community.pinnedAt ? (
                      <span data-community-pinned className={`shrink-0 text-[10px] ${active ? 'text-[#fff0c9]/80' : 'text-[#fff0c9]/55'}`}>
                        고정
                      </span>
                    ) : null}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

        {isAdmin ? (
          <section>
            <div className={`mb-2 px-2 text-xs font-semibold tracking-[0.14em] ${muted}`}>ADMIN</div>
            <Link href="/admin" data-sidebar-active={isSidebarHrefActive(pathname, '/admin') ? 'true' : 'false'} className={linkClass('/admin')}>
              관리자
            </Link>
          </section>
        ) : null}
      </nav>

      <Link
        href="/settings"
        data-sidebar-active={isSidebarHrefActive(pathname, '/settings') ? 'true' : 'false'}
        className={`mt-4 flex items-center gap-3 rounded-xl border p-3 transition ${
          isSidebarHrefActive(pathname, '/settings')
            ? 'border-[#fff0c9]/30 bg-[#1d327a] text-[#fff0c9]'
            : 'border-[#fff0c9]/20 bg-[#fff0c9]/10 text-[#fff0c9] hover:bg-[#fff0c9]/15'
        }`}
      >
        <Avatar displayName={profile.displayName} avatarPath={profile.avatarPath} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{profile.displayName}</span>
      </Link>
    </aside>
  )
}
