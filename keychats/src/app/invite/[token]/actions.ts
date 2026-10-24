'use server'

import { redirect } from 'next/navigation'

import { registerWithInvite } from '@/lib/auth/invite-supabase'
import { createAdminClient } from '@/lib/supabase/admin'

export type InviteRegistrationState = {
  error: string | null
}

const GENERIC_INVITE_ERROR = '초대 링크가 유효하지 않거나 더 이상 사용할 수 없습니다.'
const INPUT_ERROR = '아이디, 표시 이름, 비밀번호를 다시 확인해주세요.'

export async function registerInvite(
  token: string,
  _previousState: InviteRegistrationState,
  formData: FormData,
): Promise<InviteRegistrationState> {
  const input = {
    loginId: String(formData.get('loginId') ?? ''),
    displayName: String(formData.get('displayName') ?? ''),
    password: String(formData.get('password') ?? ''),
  }

  try {
    const admin = createAdminClient()
    await registerWithInvite(admin, token, input)
  } catch (error) {
    if (error instanceof Error && ['LOGIN_ID_INVALID', 'DISPLAY_NAME_INVALID', 'PASSWORD_INVALID'].includes(error.message)) {
      return { error: INPUT_ERROR }
    }
    return { error: GENERIC_INVITE_ERROR }
  }

  redirect('/login?registered=1')
}
