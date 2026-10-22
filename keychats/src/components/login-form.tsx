'use client'

import { useActionState } from 'react'

import { login, type LoginState } from '@/app/login/actions'

const initialState: LoginState = { error: null }

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState)

  return (
    <section className="w-full max-w-sm rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
      <p className="text-xs font-semibold tracking-[0.2em] text-black/40">KEYCHATS</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">로그인</h1>
      <p className="mt-2 text-sm leading-6 text-black/50">
        초대받아 생성한 아이디와 비밀번호를 입력하세요.
      </p>

      <form action={formAction} className="mt-8 space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-zinc-950">아이디</span>
          <input
            name="loginId"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={24}
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-black/35"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-zinc-950">비밀번호</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-black/35"
          />
        </label>

        {state.error ? (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? '로그인 중…' : '로그인'}
        </button>
      </form>
    </section>
  )
}
