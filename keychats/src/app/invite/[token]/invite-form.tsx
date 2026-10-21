'use client'

import { useActionState } from 'react'

import { registerInvite, type InviteRegistrationState } from './actions'

const initialState: InviteRegistrationState = { error: null }

export function InviteForm({ token }: { token: string }) {
  const action = registerInvite.bind(null, token)
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm font-medium">아이디</span>
        <input
          name="loginId"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          minLength={3}
          maxLength={24}
          pattern="[A-Za-z0-9_]+"
          className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/35"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium">표시 이름</span>
        <input
          name="displayName"
          type="text"
          autoComplete="name"
          required
          maxLength={60}
          className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/35"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium">비밀번호</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/35"
        />
        <span className="mt-2 block text-xs text-black/45">8자 이상</span>
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? '가입 중…' : '계정 만들기'}
      </button>
    </form>
  )
}
