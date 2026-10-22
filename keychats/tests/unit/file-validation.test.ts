import { describe, expect, it } from 'vitest'

import {
  MAX_ATTACHMENT_BYTES,
  validateAttachmentFile,
} from '@/lib/files/validation'

function file(name: string, type: string, size: number) {
  return { name, type, size }
}

describe('attachment validation', () => {
  it('accepts the exact 10 MiB boundary', () => {
    expect(
      validateAttachmentFile(file('photo.png', 'image/png', MAX_ATTACHMENT_BYTES)),
    ).toEqual({ ok: true })
  })

  it('rejects 10 MiB plus one byte', () => {
    expect(
      validateAttachmentFile(file('photo.png', 'image/png', MAX_ATTACHMENT_BYTES + 1)),
    ).toEqual({ ok: false, code: 'FILE_TOO_LARGE' })
  })

  it.each([
    ['photo.jpg', 'image/jpeg'],
    ['photo.jpeg', 'image/jpeg'],
    ['photo.webp', 'image/webp'],
    ['reaction.gif', 'image/gif'],
    ['document.pdf', 'application/pdf'],
    ['archive.zip', 'application/zip'],
    ['notes.txt', 'text/plain'],
    [
      'document.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    [
      'sheet.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    [
      'slides.pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
  ])('accepts %s with its allowed MIME type', (name, type) => {
    expect(validateAttachmentFile(file(name, type, 1024))).toEqual({ ok: true })
  })

  it.each([
    ['payload.exe', 'application/octet-stream'],
    ['payload.dll', 'application/octet-stream'],
    ['run.bat', 'text/plain'],
    ['run.cmd', 'text/plain'],
    ['run.ps1', 'text/plain'],
    ['run.sh', 'text/plain'],
    ['script.js', 'text/javascript'],
    ['page.html', 'text/html'],
  ])('rejects executable or script file %s', (name, type) => {
    expect(validateAttachmentFile(file(name, type, 1024))).toEqual({
      ok: false,
      code: 'FILE_TYPE_BLOCKED',
    })
  })

  it('rejects a dangerous extension even when MIME claims to be an image', () => {
    expect(validateAttachmentFile(file('avatar.exe', 'image/png', 1024))).toEqual({
      ok: false,
      code: 'FILE_TYPE_BLOCKED',
    })
  })

  it('rejects an allowed extension when MIME does not match it', () => {
    expect(validateAttachmentFile(file('avatar.png', 'application/pdf', 1024))).toEqual({
      ok: false,
      code: 'FILE_TYPE_MISMATCH',
    })
  })

  it('accepts a clipboard PNG with a generated png filename', () => {
    expect(validateAttachmentFile(file('clipboard-1730000000000.png', 'image/png', 2048))).toEqual({
      ok: true,
    })
  })

  it('rejects empty files', () => {
    expect(validateAttachmentFile(file('empty.txt', 'text/plain', 0))).toEqual({
      ok: false,
      code: 'FILE_EMPTY',
    })
  })
})
