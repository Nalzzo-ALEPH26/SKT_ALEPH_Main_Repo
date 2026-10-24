import type { SupabaseClient } from '@supabase/supabase-js'

import { validateAttachmentFile } from '@/lib/files/validation'

export type AttachmentMetadata = {
  id: string
  messageId: number
  originalName: string
  mimeType: string
  sizeBytes: number
}

function extensionOf(name: string) {
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index + 1).toLowerCase() : ''
}

function toMetadata(row: {
  id: string
  message_id: number
  original_name: string
  mime_type: string
  size_bytes: number
}): AttachmentMetadata {
  return {
    id: row.id,
    messageId: row.message_id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
  }
}

export async function loadAttachmentsForMessages(
  client: SupabaseClient,
  messageIds: number[],
): Promise<AttachmentMetadata[]> {
  if (messageIds.length === 0) return []

  const { data, error } = await client
    .from('attachments')
    .select('id,message_id,original_name,mime_type,size_bytes')
    .in('message_id', messageIds)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => toMetadata(row as never))
}

export async function uploadMessageAttachments(
  client: SupabaseClient,
  input: {
    userId: string
    messageId: number
    files: File[]
  },
): Promise<AttachmentMetadata[]> {
  if (input.files.length === 0) return []

  for (const file of input.files) {
    const validation = validateAttachmentFile(file)
    if (!validation.ok) throw new Error(validation.code)
  }

  const uploadedPaths: string[] = []

  try {
    const rows = [] as Array<{
      message_id: number
      uploader_id: string
      storage_path: string
      original_name: string
      mime_type: string
      size_bytes: number
    }>

    for (const file of input.files) {
      const extension = extensionOf(file.name)
      const path = `${input.userId}/${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await client.storage
        .from('chat-attachments')
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) throw uploadError
      uploadedPaths.push(path)
      rows.push({
        message_id: input.messageId,
        uploader_id: input.userId,
        storage_path: path,
        original_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      })
    }

    const { data, error: insertError } = await client
      .from('attachments')
      .insert(rows)
      .select('id,message_id,original_name,mime_type,size_bytes')

    if (insertError) throw insertError
    return (data ?? []).map((row) => toMetadata(row as never))
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await client.storage.from('chat-attachments').remove(uploadedPaths)
    }
    throw error
  }
}
