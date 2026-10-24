import { loginIdToInternalEmail, normalizeLoginId } from '@/lib/auth/login-id'

export const KEYCHATS_PROJECT_REF = 'otcohkelaqajomlashgy'
export const PLANDOSEE_PROJECT_REF = 'rluscctcdfqrrfaxdeya'
export const KEYCHATS_ADMIN_LOGIN_ID = 'cxu1344'

type BootstrapAdminInput = {
  projectRef: string
  loginId: string
  password: string
  displayName?: string
}

type BootstrapAdminDependencies = {
  upsertAuthAdmin: (input: {
    email: string
    password: string
    appMetadata: { role: 'admin' }
  }) => Promise<{ userId: string }>
  upsertProfile: (input: {
    userId: string
    username: string
    displayName: string
    status: 'active'
  }) => Promise<void>
  upsertSettings: (userId: string) => Promise<void>
  ensureGeneralMembership: (userId: string, options: { isDefault: true }) => Promise<void>
  log?: (message: string, context?: Record<string, unknown>) => void
}

export async function bootstrapAdmin(
  dependencies: BootstrapAdminDependencies,
  input: BootstrapAdminInput,
) {
  if (input.projectRef !== KEYCHATS_PROJECT_REF) {
    throw new Error('PROJECT_REF_NOT_KEYCHATS')
  }

  const loginId = normalizeLoginId(input.loginId)
  if (loginId !== KEYCHATS_ADMIN_LOGIN_ID) {
    throw new Error('ADMIN_LOGIN_ID_INVALID')
  }

  if (input.password.length < 8 || input.password.length > 72) {
    throw new Error('PASSWORD_INVALID')
  }

  const displayName = input.displayName?.trim() || 'Keychats Admin'
  const { userId } = await dependencies.upsertAuthAdmin({
    email: loginIdToInternalEmail(loginId),
    password: input.password,
    appMetadata: { role: 'admin' },
  })

  await dependencies.upsertProfile({
    userId,
    username: loginId,
    displayName,
    status: 'active',
  })
  await dependencies.upsertSettings(userId)
  await dependencies.ensureGeneralMembership(userId, { isDefault: true })

  dependencies.log?.('Keychats admin bootstrap complete', { userId, loginId })

  return { userId, loginId }
}
