import { describe, expect, it, vi } from 'vitest'

import {
  submitSignupRequest,
  validateSignupRequestInput,
} from '@/lib/auth/signup-requests'

const input = {
  loginId: 'member_one',
  displayName: 'Member One',
  password: 'password123',
}

function dependencies() {
  return {
    isLoginIdUnavailable: vi.fn().mockResolvedValue(false),
    createAuthUser: vi.fn().mockResolvedValue({ id: '77777777-7777-7777-7777-777777777777' }),
    persistRequest: vi.fn().mockResolvedValue(undefined),
    deleteAuthUser: vi.fn().mockResolvedValue(undefined),
  }
}

describe('validateSignupRequestInput', () => {
  it('normalizes the login ID and display name without changing the password', () => {
    expect(
      validateSignupRequestInput({
        loginId: '  MEMBER_ONE  ',
        displayName: '  Member One  ',
        password: 'password123',
      }),
    ).toEqual(input)
  })

  it('enforces existing ID, display-name, and password limits', () => {
    expect(() => validateSignupRequestInput({ ...input, loginId: 'AA' })).toThrow('LOGIN_ID_INVALID')
    expect(() => validateSignupRequestInput({ ...input, displayName: ' '.repeat(2) })).toThrow('DISPLAY_NAME_INVALID')
    expect(() => validateSignupRequestInput({ ...input, password: '1234567' })).toThrow('PASSWORD_INVALID')
    expect(() => validateSignupRequestInput({ ...input, password: 'x'.repeat(73) })).toThrow('PASSWORD_INVALID')
  })
})

describe('submitSignupRequest', () => {
  it('rejects an unavailable login ID before creating an Auth user', async () => {
    const deps = dependencies()
    deps.isLoginIdUnavailable.mockResolvedValue(true)

    await expect(submitSignupRequest(deps, input)).rejects.toThrow('SIGNUP_REQUEST_CONFLICT')
    expect(deps.createAuthUser).not.toHaveBeenCalled()
    expect(deps.persistRequest).not.toHaveBeenCalled()
  })

  it('deletes a newly created Auth user when request persistence fails', async () => {
    const deps = dependencies()
    deps.persistRequest.mockRejectedValue(new Error('SIGNUP_REQUEST_CONFLICT'))

    await expect(submitSignupRequest(deps, input)).rejects.toThrow('SIGNUP_REQUEST_CONFLICT')
    expect(deps.deleteAuthUser).toHaveBeenCalledWith('77777777-7777-7777-7777-777777777777')
  })

  it('persists only account metadata and never passes the password to request storage', async () => {
    const deps = dependencies()

    await expect(submitSignupRequest(deps, input)).resolves.toEqual({
      userId: '77777777-7777-7777-7777-777777777777',
      loginId: 'member_one',
    })

    expect(deps.createAuthUser).toHaveBeenCalledWith({
      email: 'member_one@auth.keychats.invalid',
      password: 'password123',
    })
    expect(deps.persistRequest).toHaveBeenCalledWith({
      authUserId: '77777777-7777-7777-7777-777777777777',
      username: 'member_one',
      displayName: 'Member One',
    })
    expect(deps.persistRequest.mock.calls[0]?.[0]).not.toHaveProperty('password')
    expect(deps.deleteAuthUser).not.toHaveBeenCalled()
  })
})
