'use server'

import { redirect } from 'next/navigation'

import { loginIdToInternalEmail } from '@/lib/auth/login-id'
import { createClient } from '@/lib/supabase/server'

export type LoginState = {
  error: string | null
}

const GENERIC_LOGIN_ERROR = '아이디 또는 비밀번호가 올바르지 않습니다.'

export async function login(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const rawLoginId = String(formData.get('loginId') ?? '')
  const password = String(formData.get('password') ?? '')

  let email: string

  try {
    email = loginIdToInternalEmail(rawLoginId)
  } catch {
    return { error: GENERIC_LOGIN_ERROR }
  }

  if (!password) {
    return { error: GENERIC_LOGIN_ERROR }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: GENERIC_LOGIN_ERROR }
  }

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  if (claimsError || !userId) {
    await supabase.auth.signOut()
    return { error: GENERIC_LOGIN_ERROR }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileError || profile?.status !== 'active') {
    await supabase.auth.signOut()
    return { error: GENERIC_LOGIN_ERROR }
  }

  const { data: firstChannel, error: channelError } = await supabase
    .from('channels')
    .select('id')
    .order('is_default', { ascending: false })
    .order('name')
    .limit(1)
    .maybeSingle()

  if (channelError) {
    throw channelError
  }

  redirect(firstChannel?.id ? `/channel/${firstChannel.id}` : '/settings')
}
