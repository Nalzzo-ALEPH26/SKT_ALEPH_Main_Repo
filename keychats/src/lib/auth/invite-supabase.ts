import 'server-only'

import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  completeInviteRegistration,
  createInviteMaterial,
  hashInviteToken,
  type InviteClaimHandle,
  type InviteRegistrationDependencies,
  type InviteRegistrationInput,
} from '@/lib/auth/invites'

function assertNoError(error: unknown, code: string): void {
  if (error) {
    throw new Error(code, { cause: error })
  }
}

export function createSupabaseInviteDependencies(admin: SupabaseClient): InviteRegistrationDependencies {
  return {
    async claimInvite(rawToken, now) {
      const handle: InviteClaimHandle = {
        tokenHash: hashInviteToken(rawToken),
        claimId: randomUUID(),
      }

      const { data, error } = await admin.rpc('claim_invite_server', {
        target_token_hash: handle.tokenHash,
        requested_claim_id: handle.claimId,
        at_time: now.toISOString(),
      })
      assertNoError(error, 'INVITE_CLAIM_FAILED')

      return data === true ? handle : null
    },

    async createAuthUser({ email, password }) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { role: 'member' },
      })
      assertNoError(error, 'AUTH_USER_CREATE_FAILED')

      if (!data.user) {
        throw new Error('AUTH_USER_CREATE_FAILED')
      }

      return { id: data.user.id }
    },

    async provisionWorkspaceUser({ userId, username, displayName }) {
      const { data: general, error: generalError } = await admin
        .from('channels')
        .select('id')
        .eq('name', 'general')
        .limit(1)
        .maybeSingle()
      assertNoError(generalError, 'GENERAL_CHANNEL_LOOKUP_FAILED')

      if (!general?.id) {
        throw new Error('GENERAL_CHANNEL_MISSING')
      }

      const { error: profileError } = await admin.from('profiles').insert({
        user_id: userId,
        username,
        display_name: displayName,
        status: 'active',
      })
      assertNoError(profileError, 'PROFILE_CREATE_FAILED')

      const { error: settingsError } = await admin.from('user_settings').insert({
        user_id: userId,
        theme: 'light',
      })
      assertNoError(settingsError, 'USER_SETTINGS_CREATE_FAILED')

      const { error: membershipError } = await admin.from('channel_members').insert({
        channel_id: general.id,
        user_id: userId,
        role: 'member',
      })
      assertNoError(membershipError, 'GENERAL_MEMBERSHIP_CREATE_FAILED')
    },

    async finalizeInvite(handle, userId, now) {
      const { data, error } = await admin.rpc('finalize_invite_server', {
        target_token_hash: handle.tokenHash,
        requested_claim_id: handle.claimId,
        target_user_id: userId,
        at_time: now.toISOString(),
      })
      assertNoError(error, 'INVITE_FINALIZE_FAILED')
      return data === true
    },

    async deleteAuthUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId)
      assertNoError(error, 'AUTH_USER_DELETE_FAILED')
    },

    async releaseInviteClaim(handle) {
      const { error } = await admin.rpc('release_invite_claim_server', {
        target_token_hash: handle.tokenHash,
        requested_claim_id: handle.claimId,
      })
      assertNoError(error, 'INVITE_RELEASE_FAILED')
    },
  }
}

export async function createInvite(admin: SupabaseClient, createdBy: string, now = new Date()) {
  const material = createInviteMaterial(now)
  const { data, error } = await admin
    .from('invites')
    .insert({
      token_hash: material.tokenHash,
      created_by: createdBy,
      created_at: material.persisted.created_at.toISOString(),
      expires_at: material.persisted.expires_at.toISOString(),
    })
    .select('id')
    .single()
  assertNoError(error, 'INVITE_CREATE_FAILED')

  if (!data?.id) {
    throw new Error('INVITE_CREATE_FAILED')
  }

  return {
    inviteId: data.id as string,
    rawToken: material.rawToken,
    expiresAt: material.persisted.expires_at,
  }
}

export async function registerWithInvite(
  admin: SupabaseClient,
  rawToken: string,
  input: InviteRegistrationInput,
  now = new Date(),
) {
  return completeInviteRegistration(createSupabaseInviteDependencies(admin), rawToken, input, now)
}

export async function revokeInvite(admin: SupabaseClient, inviteId: string, now = new Date()) {
  const { data, error } = await admin
    .from('invites')
    .update({ revoked_at: now.toISOString(), claim_id: null, claimed_at: null })
    .eq('id', inviteId)
    .is('used_at', null)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle()
  assertNoError(error, 'INVITE_REVOKE_FAILED')

  return Boolean(data?.id)
}
