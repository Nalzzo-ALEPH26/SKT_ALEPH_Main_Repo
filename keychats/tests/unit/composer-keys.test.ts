import { describe, expect, it } from 'vitest'

import { shouldSubmitComposerKey } from '@/lib/messages/composer-keys'

describe('composer keyboard behavior', () => {
  it('submits plain Enter', () => {
    expect(shouldSubmitComposerKey({ key: 'Enter', shiftKey: false, isComposing: false })).toBe(true)
  })

  it('keeps Shift+Enter as a newline', () => {
    expect(shouldSubmitComposerKey({ key: 'Enter', shiftKey: true, isComposing: false })).toBe(false)
  })

  it('does not submit while Korean IME composition is active', () => {
    expect(shouldSubmitComposerKey({ key: 'Enter', shiftKey: false, isComposing: true })).toBe(false)
  })
})
