import { createHash } from 'node:crypto'

import { NextResponse } from 'next/server'

import { AuthGuardError, requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { fetchUrlPreview, normalizePreviewUrl, type UrlPreview } from '@/lib/url-preview/fetch-preview'
import { extractFirstHttpUrl } from '@/lib/url-preview/url'

const READY_TTL_MS = 24 * 60 * 60 * 1000
const FAILED_TTL_MS = 15 * 60 * 1000

type CacheRow = {
  url: string
  title: string | null
  description: string | null
  image_url: string | null
  status: 'pending' | 'ready' | 'failed' | 'blocked'
  fetched_at: string | null
}

function json(preview: UrlPreview | null, status = 200) {
  return NextResponse.json(
    { preview },
    {
      status,
      headers: { 'cache-control': 'private, no-store' },
    },
  )
}

function cacheIsFresh(row: CacheRow) {
  if (!row.fetched_at) return false
  const age = Date.now() - new Date(row.fetched_at).getTime()
  const ttl = row.status === 'ready' ? READY_TTL_MS : FAILED_TTL_MS
  return Number.isFinite(age) && age >= 0 && age < ttl
}

function previewFromCache(row: CacheRow): UrlPreview | null {
  if (row.status !== 'ready') return null
  return {
    url: row.url,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
  }
}

export async function POST(request: Request) {
  const client = await createClient()

  try {
    await requireActiveUser(createAuthGuardAccess(client))
  } catch (error) {
    if (error instanceof AuthGuardError) return json(null, 404)
    throw error
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json(null, 400)
  }

  const messageId = (body as { messageId?: unknown })?.messageId
  if (!Number.isSafeInteger(messageId) || Number(messageId) <= 0) return json(null, 400)

  const { data: message, error: messageError } = await client
    .from('messages')
    .select('id,body,deleted_at')
    .eq('id', Number(messageId))
    .is('deleted_at', null)
    .maybeSingle()

  if (messageError) throw messageError
  if (!message) return json(null, 404)

  const candidate = extractFirstHttpUrl(message.body as string | null)
  if (!candidate) return json(null)

  let normalizedUrl: string
  try {
    normalizedUrl = normalizePreviewUrl(candidate)
  } catch {
    return json(null)
  }

  const urlHash = createHash('sha256').update(normalizedUrl).digest('hex')
  const admin = createAdminClient()
  const { data: cached, error: cacheReadError } = await admin
    .from('url_previews')
    .select('url,title,description,image_url,status,fetched_at')
    .eq('message_id', Number(messageId))
    .eq('url_hash', urlHash)
    .maybeSingle()

  if (cacheReadError) throw cacheReadError
  if (cached && cacheIsFresh(cached as CacheRow)) return json(previewFromCache(cached as CacheRow))

  const preview = await fetchUrlPreview(normalizedUrl)
  const now = new Date().toISOString()
  const { error: cacheWriteError } = await admin.from('url_previews').upsert(
    {
      message_id: Number(messageId),
      url_hash: urlHash,
      url: preview?.url ?? normalizedUrl,
      title: preview?.title ?? null,
      description: preview?.description ?? null,
      image_url: preview?.imageUrl ?? null,
      status: preview ? 'ready' : 'failed',
      fetched_at: now,
    },
    { onConflict: 'message_id,url_hash' },
  )

  if (cacheWriteError) throw cacheWriteError
  return json(preview)
}
