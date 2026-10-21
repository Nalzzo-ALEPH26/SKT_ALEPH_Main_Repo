'use server'

import {
  requireAdmin,
  type AuthGuardAccess,
  type KeychatsProfile,
  type VerifiedClaims,
} from '@/lib/auth/guards'
import { createInvite, revokeInvite } from '@/lib/auth/invite-supabase'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type UserClient = Awaited<ReturnType<typeof createClient>>

function createAuthGuardAccess(client: UserClient): AuthGuardAccess {
  return {
    getClaims: async () => {
      const { data, error } = await client.auth.getClaims()
      const claims = data?.claims

      return {
        data: {
          claims: claims?.sub ? ({ ...claims, sub: claims.sub } as VerifiedClaims) : null,
        },
        error,
      }
    },
    getProfile: async (userId) => {
      const { data, error } = await client
        .from('profiles')
        .select('user_id, username, display_name, avatar_path, status')
        .eq('user_id', userId)
        .maybeSingle()

      return { data: data as KeychatsProfile | null, error }
    },
  }
}

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
