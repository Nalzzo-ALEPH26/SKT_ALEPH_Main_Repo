'use client'

import type { FormEvent } from 'react'

type FeedbackComposerProps = {
  action: (formData: FormData) => void | Promise<void>
}

export function shouldSubmitFeedback(confirm: (message: string) => boolean = window.confirm) {
  return confirm('등록하시겠습니까?')
}

export function FeedbackComposer({ action }: FeedbackComposerProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!shouldSubmitFeedback()) event.preventDefault()
  }

  return (
    <form
      action={action}
      onSubmit={handleSubmit}
      className="mt-6 rounded-2xl border border-black/10 p-4 dark:border-white/10"
    >
      <label className="block text-sm font-semibold" htmlFor="feedback-body">피드백 작성</label>
      <textarea
        id="feedback-body"
        name="body"
        required
        maxLength={4000}
        rows={4}
        placeholder="어떤 점을 개선하면 좋을까요?"
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
