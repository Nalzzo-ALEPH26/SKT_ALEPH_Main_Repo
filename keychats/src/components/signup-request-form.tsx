'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { requestSignup, type SignupRequestState } from '@/app/signup/actions'

const initialState: SignupRequestState = { status: 'idle', error: null }

export function SignupRequestForm() {
  const [state, formAction, pending] = useActionState(requestSignup, initialState)

  if (state.status === 'success') {
    return (
      <section className="w-full max-w-sm rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold tracking-[0.2em] text-black/40">KEYCHATS</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">가입 요청 완료</h1>
        <p className="mt-3 text-sm leading-6 text-black/60">관리자 승인 후 입력한 아이디와 비밀번호로 로그인할 수 있습니다.</p>
        <Link href="/login" className="mt-6 block rounded-xl bg-zinc-950 px-4 py-3 text-center text-sm font-semibold text-white">로그인으로 돌아가기</Link>
      </section>
    )
  }

  return (
    <section className="w-full max-w-sm rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
      <p className="text-xs font-semibold tracking-[0.2em] text-black/40">KEYCHATS</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">가입 요청</h1>
      <p className="mt-2 text-sm leading-6 text-black/50">정보를 입력하면 관리자에게 승인 요청이 전달됩니다.</p>

      <form action={formAction} className="mt-8 space-y-5">
        <label className="block"><span className="mb-2 block text-sm font-medium text-zinc-950">아이디</span><input name="loginId" required minLength={3} maxLength={24} autoCapitalize="none" spellCheck={false} className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-zinc-950 outline-none focus:border-black/35" /></label>
        <label className="block"><span className="mb-2 block text-sm font-medium text-zinc-950">표시 이름</span><input name="displayName" required maxLength={60} className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-zinc-950 outline-none focus:border-black/35" /></label>
        <label className="block"><span className="mb-2 block text-sm font-medium text-zinc-950">비밀번호</span><input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-zinc-950 outline-none focus:border-black/35" /></label>
        {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}
        <button type="submit" disabled={pending} className="w-full rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? '요청 중…' : '가입 요청 보내기'}</button>
      </form>
      <Link href="/login" className="mt-5 block text-center text-sm font-semibold text-zinc-600 underline">이미 계정이 있으면 로그인</Link>
    </section>
  )
}
