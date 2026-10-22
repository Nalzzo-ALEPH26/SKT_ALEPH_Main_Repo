import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  submitSignupRequest,
  type SignupRequestInput,
} from '@/lib/auth/signup-requests'

function isConflictError(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const candidate = error as { code?: unknown; status?: unknown; message?: unknown }
  if (candidate.code === '23505' || candidate.code === 'email_exists') return true

  return (
    candidate.status === 422
    && typeof candidate.message === 'string'
    && candidate.message.toLowerCase().includes('exist')
  )
}

function throwMapped(error: unknown, fallback: string): never {
  if (isConflictError(error)) throw new Error('SIGNUP_REQUEST_CONFLICT')
  throw new Error(fallback, { cause: error })
}

export async function submitSupabaseSignupRequest(
  admin: SupabaseClient,
  input: SignupRequestInput,
) {
  return submitSignupRequest(
    {
      async isLoginIdUnavailable(loginId) {
        const { data: profile, error: profileError } = await admin
          .from('profiles')
          .select('user_id')
          .eq('username', loginId)
          .limit(1)
          .maybeSingle()

        if (profileError) throwMapped(profileError, 'SIGNUP_REQUEST_LOOKUP_FAILED')
        if (profile) return true

        const { data: pending, error: pendingError } = await admin
          .from('signup_requests')
          .select('id')
          .eq('username', loginId)
          .eq('status', 'pending')
          .limit(1)
          .maybeSingle()

        if (pendingError) throwMapped(pendingError, 'SIGNUP_REQUEST_LOOKUP_FAILED')
        return Boolean(pending)
      },

      async createAuthUser({ email, password }) {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          app_metadata: { role: 'member' },
        })

        if (error) throwMapped(error, 'AUTH_USER_CREATE_FAILED')
        if (!data.user) throw new Error('AUTH_USER_CREATE_FAILED')

        return { id: data.user.id }
      },

      async persistRequest({ authUserId, username, displayName }) {
        const { error } = await admin.from('signup_requests').insert({
          auth_user_id: authUserId,
          username,
          display_name: displayName,
        })

        if (error) throwMapped(error, 'SIGNUP_REQUEST_CREATE_FAILED')
      },

      async deleteAuthUser(userId) {
        const { error } = await admin.auth.admin.deleteUser(userId)
        if (error) throw new Error('AUTH_USER_DELETE_FAILED', { cause: error })
      },
    },
    input,
  )
}
