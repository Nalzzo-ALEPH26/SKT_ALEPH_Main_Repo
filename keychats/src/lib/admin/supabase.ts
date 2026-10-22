import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { AdminRepository, ManagedUser, ManagedUserStatus } from '@/lib/admin/service'

export function createSupabaseAdminRepository(client: SupabaseClient): AdminRepository {
  return {
    async listUsers() {
      const { data, error } = await client
        .from('profiles')
        .select('user_id,username,display_name,status,created_at')
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []).map(
        (row): ManagedUser => ({
          userId: row.user_id as string,
          username: row.username as string,
          displayName: row.display_name as string,
          status: row.status as ManagedUserStatus,
          createdAt: row.created_at as string,
        }),
      )
    },

    async getUser(userId) {
      const { data, error } = await client
        .from('profiles')
        .select('user_id,username,display_name,status,created_at')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw error
      if (!data) return null
      return {
        userId: data.user_id as string,
        username: data.username as string,
        displayName: data.display_name as string,
        status: data.status as ManagedUserStatus,
        createdAt: data.created_at as string,
      }
    },

    async setStatus(userId, status) {
      const { error } = await client
        .from('profiles')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('user_id', userId)

      if (error) throw error
    },

    async updatePassword(userId, password) {
      const { error } = await client.auth.admin.updateUserById(userId, { password })
      if (error) throw error
    },

    async banUser(userId) {
      const { error } = await client.auth.admin.updateUserById(userId, {
        ban_duration: '876000h',
      })
      if (error) throw error
    },
  }
}
