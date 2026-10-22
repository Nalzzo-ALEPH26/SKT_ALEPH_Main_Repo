'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import {
  deleteManagedUser,
  disableManagedUser,
  expelManagedUser,
  listManagedUsers,
  resetManagedUserPassword,
} from '@/lib/admin/service'
import { createSupabaseAdminRepository } from '@/lib/admin/supabase'
import {
  approveSignupRequest,
  listPendingSignupRequests,
  rejectSignupRequest,
} from '@/lib/admin/signup-requests'
import { createSupabaseSignupReviewRepository } from '@/lib/admin/signup-requests-supabase'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function requireAdminContext() {
  const userClient = await createClient()
  const { claims } = await requireAdmin(createAuthGuardAccess(userClient))
  const admin = createAdminClient()
  return {
    reviewerId: claims.sub,
    userRepository: createSupabaseAdminRepository(admin),
    signupRepository: createSupabaseSignupReviewRepository(admin),
  }
}

export async function listUsersAction() {
  const { userRepository } = await requireAdminContext()
  return listManagedUsers(userRepository)
}

export async function listSignupRequestsAction() {
  const { signupRepository } = await requireAdminContext()
  return listPendingSignupRequests(signupRepository)
}

export async function approveSignupRequestAction(requestId: string) {
  const { signupRepository, reviewerId } = await requireAdminContext()
  await approveSignupRequest(signupRepository, requestId, reviewerId)
  return { status: 'approved' as const }
}

export async function rejectSignupRequestAction(requestId: string) {
  const { signupRepository, reviewerId } = await requireAdminContext()
  await rejectSignupRequest(signupRepository, requestId, reviewerId)
  return { status: 'rejected' as const }
}

export async function resetUserPasswordAction(userId: string) {
  const { userRepository } = await requireAdminContext()
  const temporaryPassword = await resetManagedUserPassword(userRepository, userId)
  return { temporaryPassword }
}

export async function disableUserAction(userId: string) {
  const { userRepository } = await requireAdminContext()
  await disableManagedUser(userRepository, userId)
  return { status: 'disabled' as const }
}

export async function expelUserAction(userId: string) {
  const { userRepository } = await requireAdminContext()
  await expelManagedUser(userRepository, userId)
  return { status: 'expelled' as const }
}

export async function deleteUserAction(userId: string) {
  const { userRepository } = await requireAdminContext()
  await deleteManagedUser(userRepository, userId)
  return { status: 'deleted' as const }
}
