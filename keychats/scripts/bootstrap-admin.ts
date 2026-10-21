import { createClient } from '@supabase/supabase-js'

import {
  bootstrapAdmin,
  KEYCHATS_ADMIN_LOGIN_ID,
  KEYCHATS_PROJECT_REF,
} from '../src/lib/auth/bootstrap-admin'

const expectedProjectUrl = `https://${KEYCHATS_PROJECT_REF}.supabase.co`
const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
const password = process.env.KEYCHATS_ADMIN_PASSWORD
const displayName = process.env.KEYCHATS_ADMIN_DISPLAY_NAME || 'Keychats Admin'

if (projectUrl !== expectedProjectUrl) {
  throw new Error('PROJECT_URL_NOT_KEYCHATS')
}
if (!secretKey) {
  throw new Error('SUPABASE_SECRET_KEY_REQUIRED')
}
if (!password) {
  throw new Error('KEYCHATS_ADMIN_PASSWORD_REQUIRED')
}

const admin = createClient(projectUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
})

async function upsertAuthAdmin(input: {
  email: string
  password: string
  appMetadata: { role: 'admin' }
}) {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listError) throw listError

  const existing = listed.users.find((user) => user.email === input.email)
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: input.password,
      email_confirm: true,
      app_metadata: {
        ...existing.app_metadata,
        ...input.appMetadata,
      },
    })
    if (error) throw error
    if (!data.user) throw new Error('ADMIN_AUTH_UPDATE_FAILED')
    return { userId: data.user.id }
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    app_metadata: input.appMetadata,
  })
  if (error) throw error
  if (!data.user) throw new Error('ADMIN_AUTH_CREATE_FAILED')
  return { userId: data.user.id }
}

async function upsertProfile(input: {
  userId: string
  username: string
  displayName: string
  status: 'active'
}) {
  const { error } = await admin.from('profiles').upsert(
    {
      user_id: input.userId,
      username: input.username,
      display_name: input.displayName,
      status: input.status,
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

async function upsertSettings(userId: string) {
  const { data, error: selectError } = await admin
    .from('user_settings')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (selectError) throw selectError
  if (data) return

  const { error } = await admin.from('user_settings').insert({ user_id: userId })
  if (error) throw error
}

async function ensureGeneralMembership(userId: string, options: { isDefault: true }) {
  const { data: existingChannel, error: lookupError } = await admin
    .from('channels')
    .select('id')
    .ilike('name', 'general')
    .limit(1)
    .maybeSingle()
  if (lookupError) throw lookupError

  let channelId = existingChannel?.id as string | undefined
  if (!channelId) {
    const { data: createdChannel, error: createError } = await admin
      .from('channels')
      .insert({
        name: 'general',
        created_by: userId,
        is_default: options.isDefault,
      })
      .select('id')
      .single()
    if (createError) throw createError
    channelId = createdChannel.id
  } else {
    const { error: defaultError } = await admin
      .from('channels')
      .update({ is_default: options.isDefault })
      .eq('id', channelId)
    if (defaultError) throw defaultError
  }

  const { error: membershipError } = await admin.from('channel_members').upsert(
    {
      channel_id: channelId,
      user_id: userId,
      role: 'owner',
    },
    { onConflict: 'channel_id,user_id' },
  )
  if (membershipError) throw membershipError
}

const result = await bootstrapAdmin(
  {
    upsertAuthAdmin,
    upsertProfile,
    upsertSettings,
    ensureGeneralMembership,
    log(message, context) {
      console.log(message, context)
    },
  },
  {
    projectRef: KEYCHATS_PROJECT_REF,
    loginId: KEYCHATS_ADMIN_LOGIN_ID,
    password,
    displayName,
  },
)

console.log('Keychats admin ready', {
  userId: result.userId,
  loginId: result.loginId,
  projectRef: KEYCHATS_PROJECT_REF,
})
