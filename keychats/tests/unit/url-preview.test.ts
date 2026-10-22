import { describe, expect, it, vi } from 'vitest'

import {
  fetchUrlPreview,
  isBlockedAddress,
  normalizePreviewUrl,
} from '@/lib/url-preview/fetch-preview'
import { extractFirstHttpUrl, splitMessageText } from '@/lib/url-preview/url'

const publicResolver = async (_hostname: string) => ['93.184.216.34']

function htmlResponse(html: string, init: ResponseInit = {}) {
  return new Response(html, {
    status: init.status ?? 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      ...(init.headers ?? {}),
    },
  })
}

describe('URL preview message parsing', () => {
  it('extracts only the first HTTP(S) URL and trims sentence punctuation', () => {
    expect(
      extractFirstHttpUrl('see https://example.com/a?x=1, then http://second.example/test.'),
    ).toBe('https://example.com/a?x=1')
    expect(extractFirstHttpUrl('ftp://example.com file')).toBeNull()
  })

  it('splits message text into safe text/url parts for automatic links', () => {
    expect(splitMessageText('before https://example.com/a after')).toEqual([
      { type: 'text', value: 'before ' },
      { type: 'url', value: 'https://example.com/a' },
      { type: 'text', value: ' after' },
    ])
  })
})

describe('URL preview SSRF boundary', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    'fc00::1',
    'fe80::1',
    'ff02::1',
    '::ffff:127.0.0.1',
  ])('blocks non-public address %s', (address) => {
    expect(isBlockedAddress(address)).toBe(true)
  })

  it.each(['93.184.216.34', '1.1.1.1', '2606:4700:4700::1111'])(
    'allows public address %s',
    (address) => {
      expect(isBlockedAddress(address)).toBe(false)
    },
  )

  it('rejects non-http schemes, credentials, localhost and private DNS answers before fetch', async () => {
    const fetchImpl = vi.fn()

    await expect(fetchUrlPreview('file:///etc/passwd', { fetchImpl, resolveHost: publicResolver })).resolves.toBeNull()
    await expect(fetchUrlPreview('http://user:pass@example.com', { fetchImpl, resolveHost: publicResolver })).resolves.toBeNull()
    await expect(fetchUrlPreview('http://localhost:3000', { fetchImpl, resolveHost: publicResolver })).resolves.toBeNull()
    await expect(
      fetchUrlPreview('https://private.example', {
        fetchImpl,
        resolveHost: async () => ['10.10.10.10'],
      }),
    ).resolves.toBeNull()

    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('passes the validated DNS addresses to the production request transport instead of re-resolving the hostname', async () => {
    const requestImpl = vi.fn(async () => htmlResponse('<title>Pinned transport</title>'))
    const globalFetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('global fetch must not run'))

    try {
      const result = await fetchUrlPreview(
        'https://example.com/page',
        {
          resolveHost: async () => ['93.184.216.34'],
          requestImpl,
        } as never,
      )

      expect(result?.title).toBe('Pinned transport')
      expect(requestImpl).toHaveBeenCalledWith(
        expect.any(URL),
        ['93.184.216.34'],
        expect.objectContaining({ timeoutMs: 5_000, maxBytes: 512 * 1024 }),
      )
      expect(globalFetch).not.toHaveBeenCalled()
    } finally {
      globalFetch.mockRestore()
    }
  })

  it('rejects a public URL that redirects to a blocked address', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: { location: 'http://169.254.169.254/latest/meta-data' },
      }),
    )

    await expect(
      fetchUrlPreview('https://example.com/start', { fetchImpl, resolveHost: publicResolver }),
    ).resolves.toBeNull()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('caps redirect chains', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const current = new URL(String(input))
      const n = Number(current.searchParams.get('n') ?? '0')
      return new Response(null, {
        status: 302,
        headers: { location: `https://example.com/?n=${n + 1}` },
      })
    })

    await expect(
      fetchUrlPreview('https://example.com/?n=0', {
        fetchImpl,
        resolveHost: publicResolver,
        maxRedirects: 2,
      }),
    ).resolves.toBeNull()
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('rejects responses larger than the configured HTML byte cap', async () => {
    const fetchImpl = vi.fn(async () =>
      htmlResponse('x'.repeat(128), { headers: { 'content-length': '128' } }),
    )

    await expect(
      fetchUrlPreview('https://example.com', {
        fetchImpl,
        resolveHost: publicResolver,
        maxBytes: 64,
      }),
    ).resolves.toBeNull()
  })

  it('aborts slow requests', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        await new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          )
        }),
    )

    await expect(
      fetchUrlPreview('https://example.com', {
        fetchImpl,
        resolveHost: publicResolver,
        timeoutMs: 5,
      }),
    ).resolves.toBeNull()
  })

  it('returns sanitized OpenGraph metadata and resolves a safe relative image URL', async () => {
    const fetchImpl = vi.fn(async () =>
      htmlResponse(`<!doctype html>
        <html><head>
          <meta content="  Example &amp; Preview  " property="og:title">
          <meta property="og:description" content="A <b>safe</b> description">
          <meta property="og:image" content="/cover.png">
          <title>Fallback title</title>
        </head></html>`),
    )

    await expect(
      fetchUrlPreview('https://example.com/page#fragment', {
        fetchImpl,
        resolveHost: publicResolver,
      }),
    ).resolves.toEqual({
      url: 'https://example.com/page',
      title: 'Example & Preview',
      description: 'A safe description',
      imageUrl: 'https://example.com/cover.png',
    })
  })

  it('normalizes fragments away for cache keys', () => {
    expect(normalizePreviewUrl('HTTPS://Example.COM:443/a?b=1#section')).toBe(
      'https://example.com/a?b=1',
    )
  })
})
