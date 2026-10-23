'use client'

import type { FormEvent } from 'react'

type CommunityComposerProps = {
  action: (formData: FormData) => void | Promise<void>
}

export function CommunityComposer({ action }: CommunityComposerProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!window.confirm('등록하시겠습니까?')) event.preventDefault()
  }

  return (
    <form
      action={action}
      onSubmit={handleSubmit}
      className="mt-6 rounded-2xl border border-black/10 p-4 dark:border-white/10"
    >
      <label className="block text-sm font-semibold" htmlFor="community-body">글 작성</label>
      <textarea
        id="community-body"
        name="body"
        required
        maxLength={4000}
        rows={4}
        placeholder="내용을 입력하세요."
        className="mt-3 w-full resize-y rounded-xl border border-black/20 bg-white px-3 py-2 text-sm text-black outline-none focus:border-black dark:border-white/20 dark:bg-zinc-950 dark:text-white"
      />
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-zinc-950"
        >
          등록
        </button>
      </div>
    </form>
  )
}
