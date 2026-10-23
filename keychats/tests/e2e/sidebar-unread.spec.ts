import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const password = 'E2eKeychats!2026'

type Fixture = {
  admin: SupabaseClient
  firstChannelId: string
  secondChannelId: string
  dmThreadId: string
  first: { loginId: string; userId: string }
  second: { loginId: string; userId: string }
}

function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`E2E_ENV_MISSING:${name}`)
  return value
}

async function createFixture(): Promise<Fixture> {
  const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  const secret = requiredEnv('SUPABASE_SECRET_KEY')
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

  const createUser = async (prefix: string, displayName: string) => {
    const loginId = `${prefix}_${suffix}`.slice(0, 24)
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

    return { loginId, userId: data.user.id }
  }

  const first = await createUser('unread_a', 'Unread Alpha')
  const second = await createUser('unread_b', 'Unread Beta')

  const { data: channels, error: channelError } = await admin
    .from('channels')
    .insert([
      { name: `unread-home-${suffix}`.slice(0, 80), created_by: first.userId },
      { name: `unread-other-${suffix}`.slice(0, 80), created_by: first.userId },
    ])
    .select('id,name')
  if (channelError || !channels || channels.length !== 2) {
    throw channelError ?? new Error('E2E_CHANNEL_CREATE_FAILED')
  }

  const firstChannelId = channels.find((row) => String(row.name).startsWith('unread-home-'))?.id as string
  const secondChannelId = channels.find((row) => String(row.name).startsWith('unread-other-'))?.id as string
  if (!firstChannelId || !secondChannelId) throw new Error('E2E_CHANNEL_IDS_MISSING')

  const { error: memberError } = await admin.from('channel_members').insert([
    { channel_id: firstChannelId, user_id: first.userId, role: 'owner' },
    { channel_id: firstChannelId, user_id: second.userId, role: 'member' },
    { channel_id: secondChannelId, user_id: first.userId, role: 'owner' },
    { channel_id: secondChannelId, user_id: second.userId, role: 'member' },
  ])
  if (memberError) throw memberError

  const [userLow, userHigh] = [first.userId, second.userId].sort()
  const { data: dmThread, error: dmError } = await admin
    .from('dm_threads')
    .insert({ user_low: userLow, user_high: userHigh })
    .select('id')
    .single()
  if (dmError || !dmThread) throw dmError ?? new Error('E2E_DM_CREATE_FAILED')

  return {
    admin,
    firstChannelId,
    secondChannelId,
    dmThreadId: dmThread.id as string,
    first,
    second,
  }
}

async function cleanupFixture(fixture: Fixture | null) {
  if (!fixture) return
  await fixture.admin.from('dm_threads').delete().eq('id', fixture.dmThreadId)
  await fixture.admin.from('channels').delete().in('id', [fixture.firstChannelId, fixture.secondChannelId])
  await fixture.admin.auth.admin.deleteUser(fixture.first.userId)
  await fixture.admin.auth.admin.deleteUser(fixture.second.userId)
}

async function loginAndOpenChannel(
  context: BrowserContext,
  loginId: string,
  channelId: string,
) {
  const page = await context.newPage()
  await page.goto('/chats/login')
  await page.getByLabel('아이디').fill(loginId)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
  await page.waitForURL(/\/chats\/channel\//)
  await page.goto(`/chats/channel/${channelId}`)
  await expect(page.locator('[data-channel-message-pane]')).toBeVisible()
  await expect(page.locator('[data-channel-message-pane]')).toHaveAttribute(
    'data-realtime-status',
    'ready',
    { timeout: 12_000 },
  )
  return page
}

async function expectUnreadCount(link: ReturnType<Page['getByRole']>, count: number) {
  const badge = link.locator('[data-unread-badge]')
  if (count === 0) {
    await expect(badge).toHaveCount(0)
    return
  }
  await expect(badge).toHaveText(String(count), { timeout: 10_000 })
}

test('shows live unread counts for channels and DMs and clears them when opened', async ({ browser }) => {
  let fixture: Fixture | null = null
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })

  try {
    fixture = await createFixture()
    const page = await loginAndOpenChannel(context, fixture.first.loginId, fixture.firstChannelId)

    await expect(page.locator('aside').first()).toHaveAttribute(
      'data-unread-realtime-status',
      'ready',
      { timeout: 12_000 },
    )

    const secondChannelLink = page.getByRole('link', { name: /#unread-other-/ }).first()
    const dmLink = page.getByRole('link', { name: /Unread Beta/ }).first()
    await expect(secondChannelLink).toBeVisible()
    await expect(dmLink).toBeVisible()
    await expectUnreadCount(secondChannelLink, 0)
    await expectUnreadCount(dmLink, 0)

    const { error: channelMessageError } = await fixture.admin.from('messages').insert({
      channel_id: fixture.secondChannelId,
      sender_id: fixture.second.userId,
      body: `channel-unread-${Date.now()}`,
    })
    if (channelMessageError) throw channelMessageError

    await expectUnreadCount(secondChannelLink, 1)
    await secondChannelLink.click()
    await expect(page).toHaveURL(`http://localhost:3000/chats/channel/${fixture.secondChannelId}`)
    await expectUnreadCount(page.getByRole('link', { name: /#unread-other-/ }).first(), 0)

    await page.goto(`/chats/channel/${fixture.firstChannelId}`)
    await expect(page.locator('[data-channel-message-pane]')).toBeVisible()

    const { error: dmMessageError } = await fixture.admin.from('messages').insert({
      dm_thread_id: fixture.dmThreadId,
      sender_id: fixture.second.userId,
      body: `dm-unread-${Date.now()}`,
    })
    if (dmMessageError) throw dmMessageError

    const currentDmLink = page.getByRole('link', { name: /Unread Beta/ }).first()
    await expectUnreadCount(currentDmLink, 1)
    await currentDmLink.click()
    await expect(page).toHaveURL(`http://localhost:3000/chats/dm/${fixture.dmThreadId}`)
    await expectUnreadCount(page.getByRole('link', { name: /Unread Beta/ }).first(), 0)
  } finally {
    await context.close()
    await cleanupFixture(fixture)
  }
})
