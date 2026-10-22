import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test, type Page } from '@playwright/test'

const password = 'E2eKeychats!2026'

function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`E2E_ENV_MISSING:${name}`)
  return value
}

function adminClient() {
  return createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('SUPABASE_SECRET_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

function authenticatedClient() {
  return createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

async function createUser(admin: SupabaseClient, loginId: string, displayName: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `${loginId}@auth.keychats.invalid`,
    password,
    email_confirm: true,
    app_metadata: { role: 'member' },
  })
  if (error || !data.user) throw error ?? new Error('E2E_USER_CREATE_FAILED')

  const { error: profileError } = await admin.from('profiles').insert({
    user_id: data.user.id,
    username: loginId,
    display_name: displayName,
    status: 'active',
  })
  if (profileError) throw profileError
  return data.user.id
}

async function login(page: Page, loginId: string) {
  await page.goto('/chats/login')
  await page.getByLabel('아이디').fill(loginId)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(/\/chats\/channel\/[0-9a-f-]+$/)
}

function timeoutAfter<T>(milliseconds: number, code: string): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(code)), milliseconds)
  })
}

test('syncs a plain message in a channel created through the UI', async ({ browser }) => {
  const admin = adminClient()
  const receiver = authenticatedClient()
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const firstLogin = `new_a_${suffix}`.slice(0, 24)
  const secondLogin = `new_b_${suffix}`.slice(0, 24)
  const firstContext = await browser.newContext()
  const secondContext = await browser.newContext()
  let firstId: string | null = null
  let secondId: string | null = null
  let baseChannelId: string | null = null
  let createdChannelId: string | null = null
  let rawChannel: RealtimeChannel | null = null

  try {
    firstId = await createUser(admin, firstLogin, 'New Channel Alpha')
    secondId = await createUser(admin, secondLogin, 'New Channel Beta')

    const { data: base, error: baseError } = await admin
      .from('channels')
      .insert({ name: `base-${suffix}`.slice(0, 80), created_by: firstId })
      .select('id')
      .single()
    if (baseError || !base) throw baseError ?? new Error('BASE_CHANNEL_CREATE_FAILED')
    baseChannelId = base.id as string

    const { error: memberError } = await admin.from('channel_members').insert([
      { channel_id: baseChannelId, user_id: firstId, role: 'owner' },
      { channel_id: baseChannelId, user_id: secondId, role: 'member' },
    ])
    if (memberError) throw memberError

    const firstPage = await firstContext.newPage()
    await login(firstPage, firstLogin)
    await firstPage.goto(`/chats/channel/${baseChannelId}`)

    const channelName = `created-${suffix}`.slice(0, 80)
    const createDetails = firstPage.locator('details').filter({ hasText: '채널 만들기' }).first()
    await createDetails.locator('summary').click()
    await createDetails.getByLabel('채널 이름').fill(channelName)
    await createDetails.getByRole('checkbox', { name: /New Channel Beta/ }).check()
    await createDetails.getByRole('button', { name: '만들기' }).click()
    await expect(firstPage).toHaveURL(/\/chats\/channel\/[0-9a-f-]+$/)

    createdChannelId = firstPage.url().split('/').pop() ?? null
    expect(createdChannelId).toBeTruthy()

    const { data: memberships, error: membershipError } = await admin
      .from('channel_members')
      .select('user_id,role')
      .eq('channel_id', createdChannelId)
    if (membershipError) throw membershipError
    expect(memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ user_id: firstId, role: 'owner' }),
        expect.objectContaining({ user_id: secondId, role: 'member' }),
      ]),
    )
    expect(memberships).toHaveLength(2)

    await expect(firstPage.locator('[data-channel-message-pane]')).toHaveAttribute(
      'data-realtime-status',
      'ready',
      { timeout: 12_000 },
    )

    const secondPage = await secondContext.newPage()
    await login(secondPage, secondLogin)
    await secondPage.goto(`/chats/channel/${createdChannelId}`)
    await expect(secondPage).toHaveURL(`http://localhost:3000/chats/channel/${createdChannelId}`)
    await expect(secondPage.locator('[data-channel-message-pane]')).toHaveAttribute(
      'data-realtime-status',
      'ready',
      { timeout: 12_000 },
    )

    const { data: receiverAuth, error: receiverAuthError } = await receiver.auth.signInWithPassword({
      email: `${secondLogin}@auth.keychats.invalid`,
      password,
    })
    if (receiverAuthError || !receiverAuth.session?.access_token) {
      throw receiverAuthError ?? new Error('RECEIVER_AUTH_FAILED')
    }
    await receiver.realtime.setAuth(receiverAuth.session.access_token)

    let resolveRawReady!: () => void
    let rejectRawReady!: (error: Error) => void
    const rawReady = new Promise<void>((resolve, reject) => {
      resolveRawReady = resolve
      rejectRawReady = reject
    })

    let resolveRawMessage!: (value: { id: number; channel_id: string; body: string }) => void
    const rawMessage = new Promise<{ id: number; channel_id: string; body: string }>((resolve) => {
      resolveRawMessage = resolve
    })

    rawChannel = receiver
      .channel(`diagnostic:${createdChannelId}`)
      .on('system', '*', (payload) => {
        const system = payload as { extension?: string; status?: string; message?: string }
        if (system.extension !== 'postgres_changes') return
        if (system.status === 'ok') resolveRawReady()
        if (system.status === 'error' || system.status === 'timeout') {
          rejectRawReady(
            new Error(`RAW_POSTGRES_${system.status.toUpperCase()}:${system.message ?? ''}`),
          )
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${createdChannelId}`,
        },
        (payload) => resolveRawMessage(payload.new as { id: number; channel_id: string; body: string }),
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          rejectRawReady(new Error(`RAW_CHANNEL_${status}`))
        }
      })

    await Promise.race([rawReady, timeoutAfter<void>(12_000, 'RAW_REALTIME_READY_TIMEOUT')])

    const body = `plain-${Date.now()}`
    const input = firstPage.getByLabel('메시지 입력')
    const send = firstPage.locator('[data-send-message]')
    await input.fill(body)
    await expect(send).toBeEnabled()
    await send.click()

    const sent = firstPage.locator('article').filter({ hasText: body }).first()
    await expect(sent).toBeVisible({ timeout: 10_000 })
    const messageId = await sent.getAttribute('data-message-id')
    expect(messageId).toBeTruthy()

    const { data: visibleToReceiver, error: receiverSelectError } = await receiver
      .from('messages')
      .select('id,channel_id,body')
      .eq('id', Number(messageId))
      .maybeSingle()
    expect(receiverSelectError).toBeNull()
    expect(visibleToReceiver).toMatchObject({
      id: Number(messageId),
      channel_id: createdChannelId,
      body,
    })

    const rawReceived = await Promise.race([
      rawMessage,
      timeoutAfter<{ id: number; channel_id: string; body: string }>(10_000, 'RAW_REALTIME_MESSAGE_TIMEOUT'),
    ])
    expect(rawReceived).toMatchObject({
      id: Number(messageId),
      channel_id: createdChannelId,
      body,
    })

    await expect(secondPage.locator(`article[data-message-id="${messageId}"]`)).toContainText(body, {
      timeout: 10_000,
    })
  } finally {
    if (rawChannel) await receiver.removeChannel(rawChannel)
    await receiver.auth.signOut().catch(() => undefined)
    await firstContext.close()
    await secondContext.close()
    if (createdChannelId) await admin.from('channels').delete().eq('id', createdChannelId)
    if (baseChannelId) await admin.from('channels').delete().eq('id', baseChannelId)
    if (firstId) await admin.auth.admin.deleteUser(firstId)
    if (secondId) await admin.auth.admin.deleteUser(secondId)
  }
})
