import { NextResponse } from 'next/server'

import { AuthGuardError, requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const client = await createClient()

  try {
    await requireActiveUser(createAuthGuardAccess(client))
  } catch (error) {
    if (error instanceof AuthGuardError) return new NextResponse(null, { status: 404 })
    throw error
  }

  const path = new URL(request.url).searchParams.get('path')?.trim()
  if (!path) return new NextResponse(null, { status: 404 })

  const { data: profile, error } = await client
    .from('profiles')
    .select('user_id')
    .eq('avatar_path', path)
    .maybeSingle()

  if (error) throw error
  if (!profile) return new NextResponse(null, { status: 404 })

  const { data, error: signedUrlError } = await client.storage.from('avatars').createSignedUrl(path, 60)
  if (signedUrlError || !data?.signedUrl) return new NextResponse(null, { status: 404 })

  return NextResponse.redirect(data.signedUrl, 307)
}
