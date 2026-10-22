import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { PendingSignupRequest, SignupReviewRepository } from '@/lib/admin/signup-requests'

export function createSupabaseSignupReviewRepository(admin: SupabaseClient): SignupReviewRepository {
  return {
    async listPending(): Promise<PendingSignupRequest[]> {
      const { data, error } = await admin
        .from('signup_requests')
        .select('id,auth_user_id,username,display_name,requested_at')
        .eq('status', 'pending')
        .order('requested_at', { ascending: true })

      if (error) throw error

      return (data ?? []).flatMap((row) => {
        if (!row.auth_user_id) return []
        return [{
          id: row.id as string,
          authUserId: row.auth_user_id as string,
          username: row.username as string,
          displayName: row.display_name as string,
          requestedAt: row.requested_at as string,
        }]
      })
    },

    async approve(requestId, reviewerId, at) {
      const { data, error } = await admin.rpc('approve_signup_request_server', {
        target_request_id: requestId,
        reviewer_user_id: reviewerId,
        at_time: at.toISOString(),
      })
      if (error) throw error
      return data === true
    },

    async reject(requestId, reviewerId, at) {
      const { data, error } = await admin.rpc('reject_signup_request_server', {
        target_request_id: requestId,
        reviewer_user_id: reviewerId,
        at_time: at.toISOString(),
      })
      if (error) throw error
      return typeof data === 'string' ? data : null
    },

    async deleteAuthUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error) throw error
    },
  }
}
