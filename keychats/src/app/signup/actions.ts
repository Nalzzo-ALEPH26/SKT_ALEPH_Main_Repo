'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { submitSupabaseSignupRequest } from '@/lib/auth/signup-requests-supabase'

export type SignupRequestState = {
  status: 'idle' | 'success'
  error: string | null
}

export async function requestSignup(
  _previousState: SignupRequestState,
  formData: FormData,
): Promise<SignupRequestState> {
  try {
    await submitSupabaseSignupRequest(createAdminClient(), {
      loginId: String(formData.get('loginId') ?? ''),
      displayName: String(formData.get('displayName') ?? ''),
      password: String(formData.get('password') ?? ''),
    })

    return { status: 'success', error: null }
  } catch (error) {
    const code = error instanceof Error ? error.message : ''

    if (code === 'SIGNUP_REQUEST_CONFLICT') {
      return { status: 'idle', error: '이미 사용 중이거나 승인 대기 중인 아이디입니다.' }
    }

    if (code === 'LOGIN_ID_INVALID' || code === 'DISPLAY_NAME_INVALID' || code === 'PASSWORD_INVALID') {
      return { status: 'idle', error: '아이디·표시 이름·비밀번호 형식을 확인해 주세요.' }
    }

    return { status: 'idle', error: '가입 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
}
