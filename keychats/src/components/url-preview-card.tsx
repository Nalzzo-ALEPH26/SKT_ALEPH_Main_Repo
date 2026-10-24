'use client'

import { useEffect, useMemo, useState } from 'react'

import type { UrlPreview } from '@/lib/url-preview/fetch-preview'
import { extractFirstHttpUrl } from '@/lib/url-preview/url'

type UrlPreviewCardProps = {
  messageId: number
  body: string | null
  deleted: boolean
}

export function UrlPreviewCard({ messageId, body, deleted }: UrlPreviewCardProps) {
  const candidate = useMemo(() => (deleted ? null : extractFirstHttpUrl(body)), [body, deleted])
  const [preview, setPreview] = useState<UrlPreview | null>(null)

  useEffect(() => {
    setPreview(null)
    if (!candidate) return

    const controller = new AbortController()
    void fetch('/chats/api/url-preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messageId }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null
        return (await response.json()) as { preview?: UrlPreview | null }
      })
      .then((payload) => {
        if (!controller.signal.aborted) setPreview(payload?.preview ?? null)
      })
      .catch(() => undefined)

    return () => controller.abort()
  }, [candidate, messageId])

  if (!candidate || !preview) return null

  let hostname = preview.url
  try {
    hostname = new URL(preview.url).hostname
  } catch {
    // A preview URL is server-normalized; fallback text is still safe if parsing ever fails.
  }

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer nofollow"
      data-url-preview
      className="mt-2 block max-w-xl rounded-xl border border-black/10 p-3 transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
    >
      <div className="text-xs text-zinc-500">{hostname}</div>
      {preview.title ? <div className="mt-1 text-sm font-semibold">{preview.title}</div> : null}
      {preview.description ? (
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{preview.description}</p>
      ) : null}
    </a>
  )
}
