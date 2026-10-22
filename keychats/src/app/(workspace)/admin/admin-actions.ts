'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import {
  disableManagedUser,
  expelManagedUser,
  listManagedUsers,
  resetManagedUserPassword,
} from '@/lib/admin/service'
import { createSupabaseAdminRepository } from '@/lib/admin/supabase'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function requireAdminRepository() {
  const userClient = await createClient()
  await requireAdmin(createAuthGuardAccess(userClient))
  return createSupabaseAdminRepository(createAdminClient())
}

export async function listUsersAction() {
  const repository = await requireAdminRepository()
  return listManagedUsers(repository)
}

export async function resetUserPasswordAction(userId: string) {
  const repository = await requireAdminRepository()
  const temporaryPassword = await resetManagedUserPassword(repository, userId)
  return { temporaryPassword }
}

export async function disableUserAction(userId: string) {
  const repository = await requireAdminRepository()
  await disableManagedUser(repository, userId)
  return { status: 'disabled' as const }
}

export async function expelUserAction(userId: string) {
  const repository = await requireAdminRepository()
  await expelManagedUser(repository, userId)
  return { status: 'expelled' as const }
}
