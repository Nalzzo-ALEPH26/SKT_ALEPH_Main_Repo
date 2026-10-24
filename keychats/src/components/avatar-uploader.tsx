'use client'

import { useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'

import { Avatar } from '@/components/avatar'
import { validateAttachmentFile } from '@/lib/files/validation'
import { createClient } from '@/lib/supabase/client'

type AvatarUploaderProps = {
  userId: string
  displayName: string
  avatarPath: string | null
}

function extensionOf(name: string) {
  return name.slice(name.lastIndexOf('.') + 1).toLowerCase()
}

export function AvatarUploader({ userId, displayName, avatarPath }: AvatarUploaderProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || busy) return

    const validation = validateAttachmentFile(file)
    if (!validation.ok || !file.type.startsWith('image/')) {
      setError(validation.ok ? '이미지 파일만 사용할 수 있습니다.' : '지원하지 않는 이미지입니다.')
      return
    }

    setBusy(true)
    setError(null)
    const client = createClient()
    const path = `${userId}/${crypto.randomUUID()}.${extensionOf(file.name)}`

    try {
      const { error: uploadError } = await client.storage.from('avatars').upload(path, file, {
        contentType: file.type,
        upsert: false,
      })
      if (uploadError) throw uploadError

      const { error: profileError } = await client
        .from('profiles')
        .update({ avatar_path: path, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
      if (profileError) {
        await client.storage.from('avatars').remove([path])
        throw profileError
      }

      if (avatarPath) {
        await client.storage.from('avatars').remove([avatarPath])
      }
      router.refresh()
    } catch {
      setError('프로필 사진을 변경하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar displayName={displayName} avatarPath={avatarPath} />
      <div>
        <label className="inline-flex cursor-pointer rounded-xl border border-current/10 px-3 py-2 text-sm font-medium">
          {busy ? '업로드 중…' : '사진 변경'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={busy}
            onChange={handleChange}
          />
        </label>
        <p className="mt-1 text-xs opacity-50">JPG, PNG, WebP, GIF · 최대 10MB</p>
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </div>
    </div>
  )
}
