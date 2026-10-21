'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { createInvite, revokeInvite } from '@/lib/auth/invite-supabase'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function createInviteAction() {
  const userClient = await createClient()
  const { claims } = await requireAdmin(createAuthGuardAccess(userClient))
  const admin = createAdminClient()
  const invite = await createInvite(admin, claims.sub)

  return {
    inviteId: invite.inviteId,
    invitePath: `/chats/invite/${invite.rawToken}`,
    expiresAt: invite.expiresAt.toISOString(),
  }
}

export async function revokeInviteAction(inviteId: string) {
  const userClient = await createClient()
  await requireAdmin(createAuthGuardAccess(userClient))
  const admin = createAdminClient()

  return { revoked: await revokeInvite(admin, inviteId) }
}
