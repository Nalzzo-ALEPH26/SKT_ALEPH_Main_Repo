import { createHash, randomBytes } from 'node:crypto'

import { loginIdToInternalEmail, normalizeLoginId } from '@/lib/auth/login-id'

export const INVITE_TTL_MS = 60 * 60 * 1000

export type InviteUsability = 'usable' | 'revoked' | 'used' | 'expired'

export type InviteClaimHandle = {
  tokenHash: string
  claimId: string
}

export type InviteRegistrationInput = {
  loginId: string
  displayName: string
  password: string
}

type InviteLifecycle = {
  expires_at: Date
  used_at: Date | null
  revoked_at: Date | null
}

export type InviteRegistrationDependencies = {
  claimInvite: (rawToken: string, now: Date) => Promise<InviteClaimHandle | null>
  createAuthUser: (input: { email: string; password: string }) => Promise<{ id: string }>
  provisionWorkspaceUser: (input: {
    userId: string
    username: string
    displayName: string
  }) => Promise<void>
  finalizeInvite: (handle: InviteClaimHandle, userId: string, now: Date) => Promise<boolean>
  deleteAuthUser: (userId: string) => Promise<void>
  releaseInviteClaim: (handle: InviteClaimHandle) => Promise<void>
}

export function hashInviteToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

export function createInviteMaterial(createdAt = new Date()) {
  const rawToken = randomBytes(32).toString('base64url')
  const tokenHash = hashInviteToken(rawToken)
  const expiresAt = new Date(createdAt.getTime() + INVITE_TTL_MS)

  return {
    rawToken,
    tokenHash,
    persisted: {
      token_hash: tokenHash,
      created_at: createdAt,
      expires_at: expiresAt,
    },
  }
}

export function inviteUsability(invite: InviteLifecycle, now = new Date()): InviteUsability {
  if (invite.revoked_at) return 'revoked'
  if (invite.used_at) return 'used'
  if (invite.expires_at.getTime() <= now.getTime()) return 'expired'
  return 'usable'
}

export function validateInviteRegistrationInput(input: InviteRegistrationInput) {
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

export async function completeInviteRegistration(
  dependencies: InviteRegistrationDependencies,
  rawToken: string,
  input: InviteRegistrationInput,
  now = new Date(),
) {
  const validated = validateInviteRegistrationInput(input)
  const handle = await dependencies.claimInvite(rawToken, now)

  if (!handle) {
    throw new Error('INVITE_UNAVAILABLE')
  }

  let userId: string | null = null
  let finalized = false

  try {
    const authUser = await dependencies.createAuthUser({
      email: loginIdToInternalEmail(validated.loginId),
      password: validated.password,
    })
    userId = authUser.id

    await dependencies.provisionWorkspaceUser({
      userId,
      username: validated.loginId,
      displayName: validated.displayName,
    })

    finalized = await dependencies.finalizeInvite(handle, userId, now)
    if (!finalized) {
      throw new Error('INVITE_FINALIZE_FAILED')
    }

    return { userId, loginId: validated.loginId }
  } catch (error) {
    if (userId && !finalized) {
      await dependencies.deleteAuthUser(userId).catch(() => undefined)
    }
    if (!finalized) {
      await dependencies.releaseInviteClaim(handle).catch(() => undefined)
    }
    throw error
  }
}
