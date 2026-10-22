import { lookup } from 'node:dns/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest, type RequestOptions as HttpsRequestOptions } from 'node:https'
import { isIP } from 'node:net'

export type UrlPreview = {
  url: string
  title: string | null
  description: string | null
  imageUrl: string | null
}

type ResolveHost = (hostname: string) => Promise<string[]>
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
type RequestLimits = { timeoutMs: number; maxBytes: number }
type RequestTransport = (
  url: URL,
  validatedAddresses: string[],
  limits: RequestLimits,
) => Promise<Response>

export type FetchUrlPreviewOptions = {
  resolveHost?: ResolveHost
  fetchImpl?: FetchLike
  requestImpl?: RequestTransport
  timeoutMs?: number
  maxRedirects?: number
  maxBytes?: number
}

const DEFAULT_TIMEOUT_MS = 5_000
const DEFAULT_MAX_REDIRECTS = 3
const DEFAULT_MAX_BYTES = 512 * 1024

function ipv4ToInt(address: string) {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null
  }
  return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0
}

function ipv4InRange(value: number, base: string, bits: number) {
  const baseValue = ipv4ToInt(base)
  if (baseValue === null) return false
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return ((value & mask) >>> 0) === ((baseValue & mask) >>> 0)
}

function parseIpv6(address: string): bigint | null {
  let input = address.toLowerCase().split('%')[0]
  if (!input) return null

  if (input.includes('.')) {
    const lastColon = input.lastIndexOf(':')
    if (lastColon < 0) return null
    const ipv4 = ipv4ToInt(input.slice(lastColon + 1))
    if (ipv4 === null) return null
    const high = ((ipv4 >>> 16) & 0xffff).toString(16)
    const low = (ipv4 & 0xffff).toString(16)
    input = `${input.slice(0, lastColon)}:${high}:${low}`
  }

  const doubleColon = input.indexOf('::')
  if (doubleColon !== input.lastIndexOf('::')) return null

  let groups: string[]
  if (doubleColon >= 0) {
    const left = input.slice(0, doubleColon).split(':').filter(Boolean)
    const right = input.slice(doubleColon + 2).split(':').filter(Boolean)
    const missing = 8 - left.length - right.length
    if (missing < 1) return null
    groups = [...left, ...Array.from({ length: missing }, () => '0'), ...right]
  } else {
    groups = input.split(':')
  }

  if (groups.length !== 8) return null
  let result = 0n
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null
    result = (result << 16n) + BigInt(`0x${group}`)
  }
  return result
}

function ipv6InRange(value: bigint, base: bigint, bits: number) {
  if (bits === 0) return true
  const shift = BigInt(128 - bits)
  return value >> shift === base >> shift
}

const IPV6_FC00 = 0xfc00n << 112n
const IPV6_FE80 = 0xfe80n << 112n
const IPV6_FEC0 = 0xfec0n << 112n
const IPV6_FF00 = 0xff00n << 112n
const IPV6_DOC = (0x2001n << 112n) + (0x0db8n << 96n)

export function isBlockedAddress(address: string) {
  const normalized = address.replace(/^\[|\]$/g, '').split('%')[0]
  const version = isIP(normalized)

  if (version === 4) {
    const value = ipv4ToInt(normalized)
    if (value === null) return true
    return [
      ['0.0.0.0', 8],
      ['10.0.0.0', 8],
      ['100.64.0.0', 10],
      ['127.0.0.0', 8],
      ['169.254.0.0', 16],
      ['172.16.0.0', 12],
      ['192.0.0.0', 24],
      ['192.0.2.0', 24],
      ['192.168.0.0', 16],
      ['198.18.0.0', 15],
      ['198.51.100.0', 24],
      ['203.0.113.0', 24],
      ['224.0.0.0', 4],
      ['240.0.0.0', 4],
    ].some(([base, bits]) => ipv4InRange(value, base as string, bits as number))
  }

  if (version === 6) {
    const value = parseIpv6(normalized)
    if (value === null) return true
    if (value === 0n || value === 1n) return true

    // IPv4-mapped IPv6 (::ffff:a.b.c.d) must inherit IPv4 restrictions.
    if (value >> 32n === 0xffffn) {
      const embedded = Number(value & 0xffffffffn) >>> 0
      const embeddedText = [24, 16, 8, 0].map((shift) => (embedded >>> shift) & 0xff).join('.')
      return isBlockedAddress(embeddedText)
    }

    // Deprecated IPv4-compatible IPv6 space is not needed for previews.
    if (value >> 32n === 0n) return true

    return (
      ipv6InRange(value, IPV6_FC00, 7) ||
      ipv6InRange(value, IPV6_FE80, 10) ||
      ipv6InRange(value, IPV6_FEC0, 10) ||
      ipv6InRange(value, IPV6_FF00, 8) ||
      ipv6InRange(value, IPV6_DOC, 32)
    )
  }

  return true
}

export function normalizePreviewUrl(input: string) {
  const url = new URL(input)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('URL_PREVIEW_SCHEME_BLOCKED')
  if (url.username || url.password) throw new Error('URL_PREVIEW_CREDENTIALS_BLOCKED')
  url.hash = ''
  return url.toString()
}

async function defaultResolveHost(hostname: string) {
  const results = await lookup(hostname, { all: true, verbatim: true })
  return results.map((result) => result.address)
}

async function assertSafeTarget(url: URL, resolveHost: ResolveHost) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('URL_PREVIEW_SCHEME_BLOCKED')
  if (url.username || url.password) throw new Error('URL_PREVIEW_CREDENTIALS_BLOCKED')

  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('URL_PREVIEW_HOST_BLOCKED')
  }

  const addresses = isIP(hostname) ? [hostname] : await resolveHost(hostname)
  if (addresses.length === 0 || addresses.some(isBlockedAddress)) {
    throw new Error('URL_PREVIEW_ADDRESS_BLOCKED')
  }

  return addresses
}

function responseHeaders(headers: Record<string, string | string[] | undefined>) {
  const result = new Headers()
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) result.append(name, item)
    } else if (value !== undefined) {
      result.set(name, value)
    }
  }
  return result
}

function createPinnedLookup(validatedAddresses: string[]): HttpsRequestOptions['lookup'] {
  const candidates = validatedAddresses
    .map((address) => ({ address, family: isIP(address) }))
    .filter((candidate): candidate is { address: string; family: 4 | 6 } => candidate.family === 4 || candidate.family === 6)

  if (candidates.length === 0) throw new Error('URL_PREVIEW_ADDRESS_BLOCKED')

  return ((_hostname, options, callback) => {
    const requestedFamily = typeof options === 'number' ? options : options.family
    const matching = requestedFamily === 4 || requestedFamily === 6
      ? candidates.filter((candidate) => candidate.family === requestedFamily)
      : candidates

    if (matching.length === 0) {
      const error = new Error('No validated address for requested family') as NodeJS.ErrnoException
      error.code = 'ENOTFOUND'
      callback(error, '', 0)
      return
    }

    if (typeof options === 'object' && options.all) {
      callback(null, matching)
      return
    }

    callback(null, matching[0].address, matching[0].family)
  }) as HttpsRequestOptions['lookup']
}

async function pinnedNodeRequest(
  url: URL,
  validatedAddresses: string[],
  { timeoutMs, maxBytes }: RequestLimits,
): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const finishReject = (error: Error) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      reject(error)
    }

    const requester = url.protocol === 'https:' ? httpsRequest : httpRequest
    const hostname = url.hostname.replace(/^\[|\]$/g, '')
    const options: HttpsRequestOptions = {
      method: 'GET',
      lookup: createPinnedLookup(validatedAddresses),
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9',
        'accept-encoding': 'identity',
        'user-agent': 'KeychatsLinkPreview/1.0',
      },
      ...(url.protocol === 'https:' ? { servername: hostname } : {}),
    }

    const request = requester(url, options, (incoming) => {
      const status = incoming.statusCode ?? 0
      const headers = responseHeaders(incoming.headers)

      if (status >= 300 && status < 400) {
        incoming.resume()
        if (!settled) {
          settled = true
          if (timer) clearTimeout(timer)
          resolve(new Response(null, { status, headers }))
        }
        return
      }

      const contentLength = Number(headers.get('content-length'))
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        incoming.destroy()
        finishReject(new Error('URL_PREVIEW_TOO_LARGE'))
        return
      }

      const contentEncoding = headers.get('content-encoding')?.toLowerCase()
      if (contentEncoding && contentEncoding !== 'identity') {
        incoming.destroy()
        finishReject(new Error('URL_PREVIEW_ENCODING_UNSUPPORTED'))
        return
      }

      const chunks: Buffer[] = []
      let total = 0

      incoming.on('data', (chunk: Buffer | string) => {
        if (settled) return
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        total += buffer.byteLength
        if (total > maxBytes) {
          incoming.destroy()
          finishReject(new Error('URL_PREVIEW_TOO_LARGE'))
          return
        }
        chunks.push(buffer)
      })

      incoming.on('end', () => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        resolve(new Response(Buffer.concat(chunks), { status, headers }))
      })

      incoming.on('error', (error) => finishReject(error))
    })

    timer = setTimeout(() => {
      request.destroy(new Error('URL_PREVIEW_TIMEOUT'))
    }, timeoutMs)

    request.on('error', (error) => finishReject(error))
    request.end()
  })
}

async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: URL,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9',
        'user-agent': 'KeychatsLinkPreview/1.0',
      },
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function readHtmlWithLimit(response: Response, maxBytes: number) {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new Error('URL_PREVIEW_TOO_LARGE')
  if (!response.body) return ''

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let total = 0
  let html = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw new Error('URL_PREVIEW_TOO_LARGE')
    }
    html += decoder.decode(value, { stream: true })
  }
  html += decoder.decode()
  return html
}

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  }

  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase()
    if (lower.startsWith('#x')) {
      const code = Number.parseInt(lower.slice(2), 16)
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : match
    }
    if (lower.startsWith('#')) {
      const code = Number.parseInt(lower.slice(1), 10)
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : match
    }
    return named[lower] ?? match
  })
}

function cleanText(value: string | null | undefined, maxLength: number) {
  if (!value) return null
  const cleaned = decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return null
  return cleaned.slice(0, maxLength)
}

function parseAttributes(tag: string) {
  const attributes = new Map<string, string>()
  const expression = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g
  let match: RegExpExecArray | null
  while ((match = expression.exec(tag))) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '')
  }
  return attributes
}

function findMeta(html: string, key: 'og:title' | 'og:description' | 'og:image' | 'description') {
  const metaTags = html.match(/<meta\b(?:(?:"[^"]*"|'[^']*'|[^'">])*)>/gi) ?? []
  for (const tag of metaTags) {
    const attributes = parseAttributes(tag)
    const identity = (attributes.get('property') ?? attributes.get('name') ?? '').toLowerCase()
    if (identity === key) return attributes.get('content') ?? null
  }
  return null
}

function findTitle(html: string) {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html)
  return match?.[1] ?? null
}

async function safeImageUrl(
  candidate: string | null,
  pageUrl: URL,
  resolveHost: ResolveHost,
) {
  if (!candidate) return null
  try {
    const image = new URL(candidate, pageUrl)
    image.hash = ''
    await assertSafeTarget(image, resolveHost)
    return image.toString()
  } catch {
    return null
  }
}

function isRedirect(status: number) {
  return status >= 300 && status < 400
}

export async function fetchUrlPreview(
  input: string,
  options: FetchUrlPreviewOptions = {},
): Promise<UrlPreview | null> {
  const resolveHost = options.resolveHost ?? defaultResolveHost
  const requestImpl = options.requestImpl ?? pinnedNodeRequest
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES

  if (timeoutMs <= 0 || maxRedirects < 0 || maxBytes <= 0) return null

  try {
    let current = new URL(normalizePreviewUrl(input))
    let redirects = 0

    while (true) {
      const validatedAddresses = await assertSafeTarget(current, resolveHost)
      const response = options.fetchImpl
        ? await fetchWithTimeout(options.fetchImpl, current, timeoutMs)
        : await requestImpl(current, validatedAddresses, { timeoutMs, maxBytes })

      if (isRedirect(response.status)) {
        const location = response.headers.get('location')
        if (!location || redirects >= maxRedirects) return null
        current = new URL(normalizePreviewUrl(new URL(location, current).toString()))
        redirects += 1
        continue
      }

      if (!response.ok) return null
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
      if (!contentType.startsWith('text/html') && !contentType.startsWith('application/xhtml+xml')) {
        return null
      }

      const html = await readHtmlWithLimit(response, maxBytes)
      const title = cleanText(findMeta(html, 'og:title') ?? findTitle(html), 200)
      const description = cleanText(
        findMeta(html, 'og:description') ?? findMeta(html, 'description'),
        500,
      )
      const imageUrl = await safeImageUrl(findMeta(html, 'og:image'), current, resolveHost)

      if (!title && !description && !imageUrl) return null
      return {
        url: current.toString(),
        title,
        description,
        imageUrl,
      }
    }
  } catch {
    return null
  }
}
