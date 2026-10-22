'use client'

import { useState } from 'react'

import {
  approveSignupRequestAction,
  deleteUserAction,
  disableUserAction,
  expelUserAction,
  listSignupRequestsAction,
  listUsersAction,
  rejectSignupRequestAction,
  resetUserPasswordAction,
} from '@/app/(workspace)/admin/admin-actions'
import { createInviteAction, revokeInviteAction } from '@/app/(workspace)/admin/invite-actions'
import type { ManagedUser } from '@/lib/admin/service'
import type { PendingSignupRequest } from '@/lib/admin/signup-requests'

type InviteSummary = {
  id: string
  expiresAt: string
  usedAt: string | null
  revokedAt: string | null
  createdAt: string
}

type AdminPanelProps = {
  initialUsers: ManagedUser[]
  initialInvites: InviteSummary[]
  initialSignupRequests: PendingSignupRequest[]
}

function inviteState(invite: InviteSummary) {
  if (invite.usedAt) return '사용됨'
  if (invite.revokedAt) return '취소됨'
  if (new Date(invite.expiresAt).getTime() <= Date.now()) return '만료됨'
  return '사용 가능'
}

export function AdminPanel({ initialUsers, initialInvites, initialSignupRequests }: AdminPanelProps) {
  const [users, setUsers] = useState(initialUsers)
  const [invites, setInvites] = useState(initialInvites)
  const [signupRequests, setSignupRequests] = useState(initialSignupRequests)
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState<{ username: string; password: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refreshUsers() {
    setUsers(await listUsersAction())
  }

  async function refreshSignupRequests() {
    setSignupRequests(await listSignupRequestsAction())
  }

  async function reviewSignup(request: PendingSignupRequest, mode: 'approve' | 'reject') {
    const label = mode === 'approve' ? '승인' : '거절'
    if (!window.confirm(`@${request.username} 가입 요청을 ${label}할까요?`)) return
    setBusy(`signup:${request.id}`)
    setError(null)
    try {
      if (mode === 'approve') {
        await approveSignupRequestAction(request.id)
        await Promise.all([refreshSignupRequests(), refreshUsers()])
      } else {
        await rejectSignupRequestAction(request.id)
        await refreshSignupRequests()
      }
    } catch {
      setError(`가입 요청을 ${label}하지 못했습니다.`)
    } finally {
      setBusy(null)
    }
  }

  async function createInvite() {
    setBusy('invite:create')
    setError(null)
    try {
      const result = await createInviteAction()
      setCreatedInviteUrl(`${window.location.origin}${result.invitePath}`)
      setInvites((current) => [
        {
          id: result.inviteId,
          expiresAt: result.expiresAt,
          usedAt: null,
          revokedAt: null,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ])
    } catch {
      setError('초대 링크를 만들지 못했습니다.')
    } finally {
      setBusy(null)
    }
  }

  async function revokeInvite(inviteId: string) {
    setBusy(`invite:${inviteId}`)
    setError(null)
    try {
      const result = await revokeInviteAction(inviteId)
      if (result.revoked) {
        setInvites((current) =>
          current.map((invite) =>
            invite.id === inviteId ? { ...invite, revokedAt: new Date().toISOString() } : invite,
          ),
        )
      }
    } catch {
      setError('초대 링크를 취소하지 못했습니다.')
    } finally {
      setBusy(null)
    }
  }

  async function resetPassword(user: ManagedUser) {
    setBusy(`password:${user.userId}`)
    setError(null)
    setTemporaryPassword(null)
    try {
      const result = await resetUserPasswordAction(user.userId)
      setTemporaryPassword({ username: user.username, password: result.temporaryPassword })
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message === 'SOLE_ADMIN_PROTECTED'
          ? 'cxu1344 관리자 본인에게는 임시 비밀번호를 발급할 수 없습니다.'
          : '임시 비밀번호를 발급하지 못했습니다.',
      )
    } finally {
      setBusy(null)
    }
  }

  async function changeStatus(user: ManagedUser, mode: 'disable' | 'expel') {
    const label = mode === 'disable' ? '비활성화' : '퇴출'
    if (!window.confirm(`@${user.username} 계정을 ${label}할까요?`)) return
    setBusy(`${mode}:${user.userId}`)
    setError(null)
    try {
      if (mode === 'disable') await disableUserAction(user.userId)
      else await expelUserAction(user.userId)
      await refreshUsers()
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message === 'SOLE_ADMIN_PROTECTED'
          ? '유일한 관리자 계정은 변경할 수 없습니다.'
          : `계정을 ${label}하지 못했습니다.`,
      )
    } finally {
      setBusy(null)
    }
  }

  async function deleteAccount(user: ManagedUser) {
    if (!window.confirm(`@${user.username} 로그인 계정을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return
    setBusy(`delete:${user.userId}`)
    setError(null)
    try {
      await deleteUserAction(user.userId)
      await refreshUsers()
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message === 'SOLE_ADMIN_PROTECTED'
          ? 'cxu1344 관리자 계정은 삭제할 수 없습니다.'
          : '계정을 삭제하지 못했습니다.',
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-8">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-black/10 p-5 dark:border-white/10">
        <h2 className="font-semibold">가입 요청</h2>
        <p className="mt-1 text-sm text-zinc-500">승인하면 바로 Keychats를 사용할 수 있습니다.</p>
        <div className="mt-4 divide-y divide-black/5 dark:divide-white/5">
          {signupRequests.map((request) => (
            <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <div className="text-sm font-semibold">
                  {request.displayName} <span className="font-normal text-zinc-500">@{request.username}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">요청: {new Date(request.requestedAt).toLocaleString('ko-KR')}</div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => reviewSignup(request, 'approve')} disabled={busy !== null} className="rounded-lg bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-zinc-950">승인</button>
                <button type="button" onClick={() => reviewSignup(request, 'reject')} disabled={busy !== null} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-40 dark:border-red-900">거절</button>
              </div>
            </div>
          ))}
          {signupRequests.length === 0 ? <p className="py-4 text-sm text-zinc-500">대기 중인 가입 요청이 없습니다.</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-black/10 p-5 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">초대 링크 · 보조 기능</h2>
            <p className="mt-1 text-sm text-zinc-500">기존 초대 방식은 필요할 때만 사용할 수 있습니다.</p>
          </div>
          <button type="button" onClick={createInvite} disabled={busy !== null} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold disabled:opacity-40 dark:border-white/10">새 초대 만들기</button>
        </div>
        {createdInviteUrl ? (
          <div className="mt-4 rounded-xl bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
            <div className="text-xs font-medium text-zinc-500">이번에 생성된 링크</div>
            <div className="mt-1 break-all font-mono text-xs">{createdInviteUrl}</div>
            <button type="button" className="mt-2 text-xs font-semibold underline" onClick={() => void navigator.clipboard.writeText(createdInviteUrl)}>링크 복사</button>
          </div>
        ) : null}
        <div className="mt-4 divide-y divide-black/5 dark:divide-white/5">
          {invites.map((invite) => {
            const state = inviteState(invite)
            return (
              <div key={invite.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-zinc-500">{invite.id}</div>
                  <div className="mt-1">{state} · {new Date(invite.expiresAt).toLocaleString('ko-KR')} 만료</div>
                </div>
                {state === '사용 가능' ? <button type="button" onClick={() => revokeInvite(invite.id)} disabled={busy !== null} className="shrink-0 text-xs font-semibold text-red-600 disabled:opacity-40">취소</button> : null}
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-black/10 p-5 dark:border-white/10">
        <h2 className="font-semibold">사용자 관리</h2>
        <p className="mt-1 text-sm text-zinc-500">계정 삭제 시 로그인은 제거되며 과거 메시지는 유지됩니다.</p>
        {temporaryPassword ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="text-xs font-semibold">@{temporaryPassword.username} 임시 비밀번호 · 지금 한 번만 전달하세요</div>
            <code className="mt-2 block break-all text-sm">{temporaryPassword.password}</code>
            <button type="button" className="mt-2 text-xs font-semibold underline" onClick={() => void navigator.clipboard.writeText(temporaryPassword.password)}>비밀번호 복사</button>
          </div>
        ) : null}
        <div className="mt-4 divide-y divide-black/5 dark:divide-white/5">
          {users.map((user) => {
            const soleAdmin = user.username === 'cxu1344'
            return (
              <div key={user.userId} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <div className="text-sm font-semibold">{user.displayName} <span className="font-normal text-zinc-500">@{user.username}</span></div>
                  <div className="mt-1 text-xs text-zinc-500">상태: {user.status}{soleAdmin ? ' · 관리자' : ''}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => resetPassword(user)} disabled={busy !== null || soleAdmin || user.status !== 'active'} title={soleAdmin ? '관리자 본인은 설정에서 비밀번호를 변경하세요.' : undefined} className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-white/10">임시 비밀번호</button>
                  <button type="button" onClick={() => changeStatus(user, 'disable')} disabled={busy !== null || soleAdmin || user.status !== 'active'} className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-white/10">비활성화</button>
                  <button type="button" onClick={() => changeStatus(user, 'expel')} disabled={busy !== null || soleAdmin || user.status === 'expelled'} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-40 dark:border-red-900">퇴출</button>
                  <button type="button" onClick={() => deleteAccount(user)} disabled={busy !== null || soleAdmin} data-delete-user={user.userId} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">계정 삭제</button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
