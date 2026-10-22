export type MessageTextPart = {
  type: 'text' | 'url'
  value: string
}

const HTTP_URL = /https?:\/\/[^\s<>"'`]+/gi
const TRAILING_PUNCTUATION = /[.,!?;:}\]]+$/

function trimTrailingUrlPunctuation(value: string) {
  let result = value.replace(TRAILING_PUNCTUATION, '')

  while (result.endsWith(')')) {
    const opens = (result.match(/\(/g) ?? []).length
    const closes = (result.match(/\)/g) ?? []).length
    if (closes <= opens) break
    result = result.slice(0, -1)
  }

  return result
}

export function extractFirstHttpUrl(text: string | null | undefined) {
  if (!text) return null
  const match = HTTP_URL.exec(text)
  HTTP_URL.lastIndex = 0
  if (!match) return null
  const value = trimTrailingUrlPunctuation(match[0])
  return value || null
}

export function splitMessageText(text: string | null | undefined): MessageTextPart[] {
  if (!text) return []

  const parts: MessageTextPart[] = []
  let cursor = 0
  HTTP_URL.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = HTTP_URL.exec(text))) {
    const raw = match[0]
    const url = trimTrailingUrlPunctuation(raw)
    if (!url) continue

    if (match.index > cursor) {
      parts.push({ type: 'text', value: text.slice(cursor, match.index) })
    }
    parts.push({ type: 'url', value: url })

    const punctuation = raw.slice(url.length)
    if (punctuation) parts.push({ type: 'text', value: punctuation })
    cursor = match.index + raw.length
  }
  HTTP_URL.lastIndex = 0

  if (cursor < text.length) parts.push({ type: 'text', value: text.slice(cursor) })
  return parts.length > 0 ? parts : [{ type: 'text', value: text }]
}
