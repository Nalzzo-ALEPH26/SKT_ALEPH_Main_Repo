import { describe, expect, it } from 'vitest'

import { loginIdToInternalEmail, normalizeLoginId } from '@/lib/auth/login-id'

describe('normalizeLoginId', () => {
  it('trims whitespace and normalizes ASCII letters to lowercase', () => {
    expect(normalizeLoginId('  CXU1344  ')).toBe('cxu1344')
  })

  it.each([
    'ab',
    'a'.repeat(25),
    'miles-kim',
    'miles kim',
    '건희',
    'user@example.com',
  ])('rejects invalid login id %s', (loginId) => {
    expect(() => normalizeLoginId(loginId)).toThrow('LOGIN_ID_INVALID')
  })
})

describe('loginIdToInternalEmail', () => {
  it('maps normalized IDs deterministically to an internal-only email', () => {
    expect(loginIdToInternalEmail('cxu1344')).toBe('cxu1344@auth.keychats.invalid')
    expect(loginIdToInternalEmail(' CXU1344 ')).toBe('cxu1344@auth.keychats.invalid')
  })

  it('does not accept an arbitrary email as a login id', () => {
    expect(() => loginIdToInternalEmail('someone@gmail.com')).toThrow('LOGIN_ID_INVALID')
  })
})
