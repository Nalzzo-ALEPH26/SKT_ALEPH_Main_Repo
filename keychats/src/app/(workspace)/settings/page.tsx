import { AvatarUploader } from '@/components/avatar-uploader'
import { PasswordChangeForm } from '@/components/password-change-form'
import { ThemeToggle } from '@/components/theme-toggle'
import { requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { normalizeTheme } from '@/lib/settings/theme'
import { createClient } from '@/lib/supabase/server'

import { updateThemeAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const client = await createClient()
  const { claims, profile } = await requireActiveUser(createAuthGuardAccess(client))
  const { data: settings, error } = await client
    .from('user_settings')
    .select('theme')
    .eq('user_id', claims.sub)
    .maybeSingle()

  if (error) throw error
  const theme = normalizeTheme(settings?.theme ?? 'light')

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10 md:px-10">
      <p className="text-xs font-semibold tracking-[0.16em] opacity-45">SETTINGS</p>
      <h1 className="mt-3 text-2xl font-semibold">설정</h1>
      <p className="mt-2 text-sm opacity-55">{profile.display_name}</p>

      <section className="mt-8 rounded-2xl border border-current/10 p-5">
        <h2 className="text-sm font-semibold">프로필 사진</h2>
        <div className="mt-4">
          <AvatarUploader
            userId={profile.user_id}
            displayName={profile.display_name}
            avatarPath={profile.avatar_path}
          />
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-current/10 p-5">
        <h2 className="text-sm font-semibold">화면 테마</h2>
        <p className="mt-1 text-sm opacity-55">Keychats에서 사용할 Light 또는 Dark 모드를 선택합니다.</p>
        <form action={updateThemeAction} className="mt-4">
          <ThemeToggle theme={theme} />
        </form>
      </section>

      <section className="mt-4 rounded-2xl border border-current/10 p-5">
        <h2 className="text-sm font-semibold">비밀번호</h2>
        <p className="mt-1 text-sm opacity-55">현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다.</p>
        <PasswordChangeForm />
      </section>
    </div>
  )
}
