import { loginIdToInternalEmail, normalizeLoginId } from '@/lib/auth/login-id'

export type SignupRequestInput = {
  loginId: string
  displayName: string
  password: string
}

export type PersistedSignupRequestInput = {
  authUserId: string
  username: string
  displayName: string
}

export type SignupRequestDependencies = {
  isLoginIdUnavailable: (loginId: string) => Promise<boolean>
  createAuthUser: (input: { email: string; password: string }) => Promise<{ id: string }>
  persistRequest: (input: PersistedSignupRequestInput) => Promise<void>
  deleteAuthUser: (userId: string) => Promise<void>
}

export function validateSignupRequestInput(input: SignupRequestInput) {
  const loginId = normalizeLoginId(input.loginId)
  const displayName = input.displayName.trim()

  if (displayName.length < 1 || displayName.length > 60) {
    throw new Error('DISPLAY_NAME_INVALID')
  }

  if (input.password.length < 8 || input.password.length > 72) {
    throw new Error('PASSWORD_INVALID')
  }

  return {
    loginId,
    displayName,
    password: input.password,
  }
}

export async function submitSignupRequest(
  dependencies: SignupRequestDependencies,
  input: SignupRequestInput,
) {
  const validated = validateSignupRequestInput(input)

  if (await dependencies.isLoginIdUnavailable(validated.loginId)) {
    throw new Error('SIGNUP_REQUEST_CONFLICT')
  }

  const authUser = await dependencies.createAuthUser({
    email: loginIdToInternalEmail(validated.loginId),
    password: validated.password,
  })

  try {
    await dependencies.persistRequest({
      authUserId: authUser.id,
      username: validated.loginId,
      displayName: validated.displayName,
    })
  } catch (error) {
    await dependencies.deleteAuthUser(authUser.id).catch(() => undefined)
    throw error
  }

  return {
    userId: authUser.id,
    loginId: validated.loginId,
  }
}
