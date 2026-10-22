import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

import { PasswordChangeForm } from '@/components/password-change-form'

describe('PasswordChangeForm', () => {
  it('asks for the current password and a confirmed new password', () => {
    const html = renderToStaticMarkup(createElement(PasswordChangeForm))
    expect(html).toContain('name="currentPassword"')
    expect(html).toContain('name="newPassword"')
    expect(html).toContain('name="confirmPassword"')
    expect(html).toContain('비밀번호 변경')
  })
})
