import { notFound } from 'next/navigation'

import { AdminPanel } from '@/components/admin-panel'
import { AuthGuardError, requireAdmin } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { listManagedUsers } from '@/lib/admin/service'
import { createSupabaseAdminRepository } from '@/lib/admin/supabase'
import { listPendingSignupRequests } from '@/lib/admin/signup-requests'
import { createSupabaseSignupReviewRepository } from '@/lib/admin/signup-requests-supabase'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export default async function AdminPage() {
  const userClient = await createClient()
  try {
    await requireAdmin(createAuthGuardAccess(userClient))
  } catch (error) {
    if (error instanceof AuthGuardError) notFound()
    throw error
  }

  const admin = createAdminClient()
  const [users, signupRequests, { data: inviteRows, error: inviteError }] = await Promise.all([
    listManagedUsers(createSupabaseAdminRepository(admin)),
    listPendingSignupRequests(createSupabaseSignupReviewRepository(admin)),
    admin
      .from('invites')
      .select('id,expires_at,used_at,revoked_at,created_at')
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  if (inviteError) throw inviteError

  const invites = (inviteRows ?? []).map((invite) => ({
    id: invite.id as string,
    expiresAt: invite.expires_at as string,
    usedAt: (invite.used_at as string | null) ?? null,
    revokedAt: (invite.revoked_at as string | null) ?? null,
    createdAt: invite.created_at as string,
  }))

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Keychats Admin</p>
        <h1 className="mt-2 text-2xl font-semibold">관리자</h1>
      </div>
      <AdminPanel initialUsers={users} initialInvites={invites} initialSignupRequests={signupRequests} />
    </main>
  )
}
