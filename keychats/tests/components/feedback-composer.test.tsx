import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { FeedbackComposer, shouldSubmitFeedback } from '@/components/feedback-composer'

describe('FeedbackComposer', () => {
  it('places the submit control on the right side of the composer box', () => {
    const html = renderToStaticMarkup(
      createElement(FeedbackComposer, {
        action: async () => undefined,
      }),
    )

    expect(html).toContain('피드백 작성')
    expect(html).toContain('justify-end')
    expect(html).toContain('등록')
  })

  it('asks for confirmation before allowing submission', () => {
    const confirm = vi.fn(() => true)

    expect(shouldSubmitFeedback(confirm)).toBe(true)
    expect(confirm).toHaveBeenCalledWith('등록하시겠습니까?')
  })

  it('cancels submission when confirmation is declined', () => {
    expect(shouldSubmitFeedback(() => false)).toBe(false)
  })
})
