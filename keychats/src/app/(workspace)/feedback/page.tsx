import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function FeedbackPage() {
  const client = await createClient()
  const { data: community, error } = await client
    .from('communities')
    .select('id')
    .eq('name', '피드백')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  redirect(community ? `/community/${community.id}` : '/')
}
