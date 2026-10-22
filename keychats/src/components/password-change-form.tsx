'use client'

import { useState, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'

export function PasswordChangeForm() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    const form = event.currentTarget
    const formData = new FormData(form)
    const currentPassword = String(formData.get('currentPassword') ?? '')
    const newPassword = String(formData.get('newPassword') ?? '')
    const confirmPassword = String(formData.get('confirmPassword') ?? '')

    setError(null)
    setSuccess(null)

    if (newPassword.length < 8) {
      setError('새 비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('새 비밀번호 확인이 일치하지 않습니다.')
      return
    }
    if (currentPassword === newPassword) {
      setError('현재 비밀번호와 다른 비밀번호를 입력해 주세요.')
      return
    }

    setBusy(true)
    try {
      const client = createClient()
      const { data: userData, error: userError } = await client.auth.getUser()
      const email = userData.user?.email
      if (userError || !email) throw new Error('AUTH_USER_MISSING')

      const { error: verifyError } = await client.auth.signInWithPassword({
        email,
        password: currentPassword,
      })
      if (verifyError) {
        setError('현재 비밀번호가 올바르지 않습니다.')
        return
      }

      const { error: updateError } = await client.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError

      form.reset()
      setSuccess('비밀번호가 변경되었습니다.')
    } catch {
      setError('비밀번호를 변경하지 못했습니다. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">현재 비밀번호</span>
        <input
          type="password"
          name="currentPassword"
          required
          autoComplete="current-password"
          disabled={busy}
          className="w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-black outline-none focus:border-black dark:border-white/20 dark:bg-zinc-950 dark:text-white"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">새 비밀번호</span>
        <input
          type="password"
          name="newPassword"
          required
          minLength={8}
          autoComplete="new-password"
          disabled={busy}
          className="w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-black outline-none focus:border-black dark:border-white/20 dark:bg-zinc-950 dark:text-white"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">새 비밀번호 확인</span>
        <input
          type="password"
          name="confirmPassword"
          required
          minLength={8}
          autoComplete="new-password"
          disabled={busy}
          className="w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-black outline-none focus:border-black dark:border-white/20 dark:bg-zinc-950 dark:text-white"
        />
      </label>
      {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {success ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-950"
      >
        {busy ? '변경 중…' : '비밀번호 변경'}
      </button>
    </form>
  )
}
