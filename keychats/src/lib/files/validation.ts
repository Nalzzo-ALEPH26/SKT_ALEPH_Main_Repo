export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

type AttachmentFileLike = {
  name: string
  type: string
  size: number
}

type ValidationResult =
  | { ok: true }
  | {
      ok: false
      code: 'FILE_EMPTY' | 'FILE_TOO_LARGE' | 'FILE_TYPE_BLOCKED' | 'FILE_TYPE_MISMATCH'
    }

const MIME_BY_EXTENSION: Record<string, ReadonlySet<string>> = {
  jpg: new Set(['image/jpeg']),
  jpeg: new Set(['image/jpeg']),
  png: new Set(['image/png']),
  webp: new Set(['image/webp']),
  gif: new Set(['image/gif']),
  pdf: new Set(['application/pdf']),
  zip: new Set(['application/zip', 'application/x-zip-compressed']),
  txt: new Set(['text/plain']),
  docx: new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]),
  xlsx: new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]),
  pptx: new Set([
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ]),
}

const BLOCKED_EXTENSIONS = new Set([
  'exe',
  'dll',
  'com',
  'msi',
  'bat',
  'cmd',
  'ps1',
  'sh',
  'bash',
  'zsh',
  'js',
  'mjs',
  'cjs',
  'jsx',
  'ts',
  'tsx',
  'html',
  'htm',
  'svg',
  'jar',
  'app',
  'scr',
])

const BLOCKED_MIME_TYPES = new Set([
  'application/javascript',
  'application/x-javascript',
  'application/x-msdownload',
  'application/x-sh',
  'text/html',
  'text/javascript',
  'text/x-shellscript',
])

function extensionOf(name: string) {
  const normalized = name.trim().toLowerCase()
  const index = normalized.lastIndexOf('.')
  return index > -1 ? normalized.slice(index + 1) : ''
}

export function validateAttachmentFile(file: AttachmentFileLike): ValidationResult {
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, code: 'FILE_EMPTY' }
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, code: 'FILE_TOO_LARGE' }
  }

  const extension = extensionOf(file.name)
  const mimeType = file.type.trim().toLowerCase()

  if (BLOCKED_EXTENSIONS.has(extension) || BLOCKED_MIME_TYPES.has(mimeType)) {
    return { ok: false, code: 'FILE_TYPE_BLOCKED' }
  }

  const allowedMimeTypes = MIME_BY_EXTENSION[extension]
  if (!allowedMimeTypes) {
    return { ok: false, code: 'FILE_TYPE_BLOCKED' }
  }

  if (!allowedMimeTypes.has(mimeType)) {
    return { ok: false, code: 'FILE_TYPE_MISMATCH' }
  }

  return { ok: true }
}
