import { NextResponse } from 'next/server'

import { AuthGuardError, requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { createClient } from '@/lib/supabase/server'

type RouteContext = {
  params: Promise<{ attachmentId: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { attachmentId } = await params
  const client = await createClient()

  try {
    await requireActiveUser(createAuthGuardAccess(client))
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return new NextResponse(null, { status: 404 })
    }
    throw error
  }

  const { data: attachment, error } = await client
    .from('attachments')
    .select('storage_path')
    .eq('id', attachmentId)
    .maybeSingle()

  if (error) throw error
  if (!attachment) return new NextResponse(null, { status: 404 })

  const { data, error: signedUrlError } = await client.storage
    .from('chat-attachments')
    .createSignedUrl(attachment.storage_path as string, 60)

  if (signedUrlError || !data?.signedUrl) {
    return new NextResponse(null, { status: 404 })
  }

  return NextResponse.redirect(data.signedUrl, 307)
}
