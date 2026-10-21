import 'server-only'

import type {
  AuthGuardAccess,
  KeychatsProfile,
  VerifiedClaims,
} from '@/lib/auth/guards'
import type { createClient } from '@/lib/supabase/server'

type UserClient = Awaited<ReturnType<typeof createClient>>

export function createAuthGuardAccess(client: UserClient): AuthGuardAccess {
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
