import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const password = 'E2eKeychats!2026'

type Fixture = {
  admin: SupabaseClient
  channelId: string
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
  const firstLoginId = `e2e_a_${suffix}`.slice(0, 24)
  const secondLoginId = `e2e_b_${suffix}`.slice(0, 24)

  const createUser = async (loginId: string, displayName: string) => {
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

  const first = await createUser(firstLoginId, 'E2E Alpha')
  const second = await createUser(secondLoginId, 'E2E Beta')

  const { data: channel, error: channelError } = await admin
    .from('channels')
    .insert({ name: `e2e-${suffix}`.slice(0, 80), created_by: first.userId })
    .select('id')
    .single()
  if (channelError || !channel) throw channelError ?? new Error('E2E_CHANNEL_CREATE_FAILED')

  const { error: memberError } = await admin.from('channel_members').insert([
    { channel_id: channel.id, user_id: first.userId, role: 'owner' },
    { channel_id: channel.id, user_id: second.userId, role: 'member' },
  ])
  if (memberError) throw memberError

  return { admin, channelId: channel.id as string, first, second }
}

async function cleanupFixture(fixture: Fixture | null) {
  if (!fixture) return

  await fixture.admin.from('channels').delete().eq('id', fixture.channelId)
  await fixture.admin.auth.admin.deleteUser(fixture.first.userId)
  await fixture.admin.auth.admin.deleteUser(fixture.second.userId)
}

async function login(page: Page, loginId: string, channelId: string) {
  await page.goto('/chats/login')
  await page.getByLabel('아이디').fill(loginId)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(`http://localhost:3000/chats/channel/${channelId}`)
}

async function openChannel(context: BrowserContext, channelId: string, loginId: string) {
  const page = await context.newPage()
  await login(page, loginId, channelId)
  const pane = page.locator('[data-channel-message-pane]')
  await expect(pane).toBeVisible()
  await expect(pane).toHaveAttribute('data-realtime-status', 'ready', { timeout: 12_000 })
  return page
}

test('syncs channel send, reply, edit and soft-delete across two signed-in browsers', async ({ browser }) => {
  let fixture: Fixture | null = null
  const firstContext = await browser.newContext()
  const secondContext = await browser.newContext()

  try {
    fixture = await createFixture()
    const firstPage = await openChannel(firstContext, fixture.channelId, fixture.first.loginId)
    const secondPage = await openChannel(secondContext, fixture.channelId, fixture.second.loginId)

    const original = `hello-${Date.now()}`
    const firstInput = firstPage.getByLabel('메시지 입력')
    const firstSend = firstPage.locator('[data-send-message]')
    await firstInput.fill(original)
    await expect(firstInput).toHaveValue(original)
    await expect(firstSend).toBeEnabled({ timeout: 5_000 })
    await firstSend.click()

    const originalArticleOnSecond = secondPage.locator('article').filter({ hasText: original }).first()
    await expect(originalArticleOnSecond).toBeVisible({ timeout: 10_000 })
    const originalMessageId = await originalArticleOnSecond.getAttribute('data-message-id')
    expect(originalMessageId).toBeTruthy()

    await originalArticleOnSecond.hover()
    await originalArticleOnSecond.getByRole('button', { name: '답글' }).click()

    const reply = `reply-${Date.now()}`
    await secondPage.getByLabel('메시지 입력').fill(reply)
    await secondPage.locator('[data-send-message]').click()
    await expect(firstPage.getByText(reply, { exact: true })).toBeVisible({ timeout: 10_000 })

    const originalArticleOnFirst = firstPage.locator(`article[data-message-id="${originalMessageId}"]`)
    await expect(originalArticleOnFirst).toBeVisible()
    await originalArticleOnFirst.hover()
    await originalArticleOnFirst.getByRole('button', { name: '수정' }).click()

    const edited = `${original}-edited`
    await firstPage.getByLabel('메시지 입력').fill(edited)
    await firstPage.locator('[data-send-message]').click()

    const editedOnSecond = secondPage.locator(`article[data-message-id="${originalMessageId}"]`)
    await expect(editedOnSecond).toContainText(edited, { timeout: 10_000 })
    await expect(editedOnSecond).toContainText('(수정됨)')

    await originalArticleOnFirst.hover()
    await originalArticleOnFirst.getByRole('button', { name: '삭제' }).click()

    await expect(editedOnSecond).toContainText('삭제된 메시지입니다.', { timeout: 10_000 })
    await expect(editedOnSecond.getByText(edited, { exact: true })).toHaveCount(0)
  } finally {
    await firstContext.close()
    await secondContext.close()
    await cleanupFixture(fixture)
  }
})

test('opens a freshly loaded channel at the latest message', async ({ browser }) => {
  let fixture: Fixture | null = null
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })

  try {
    fixture = await createFixture()
    const { error: seedError } = await fixture.admin.from('messages').insert(
      Array.from({ length: 50 }, (_, index) => ({
        channel_id: fixture!.channelId,
        sender_id: fixture!.first.userId,
        body: `history-${String(index + 1).padStart(2, '0')} ${'message '.repeat(30)}`,
      })),
    )
    if (seedError) throw seedError

    const page = await openChannel(context, fixture.channelId, fixture.first.loginId)
    const scrollArea = page.locator('[data-conversation-message-pane] .overflow-y-auto').first()

    await expect.poll(
      () => scrollArea.evaluate((element) => element.scrollHeight > element.clientHeight),
      { timeout: 5_000 },
    ).toBe(true)

    await expect.poll(
      () => scrollArea.evaluate((element) =>
        Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) <= 2,
      ),
      { timeout: 5_000 },
    ).toBe(true)
  } finally {
    await context.close()
    await cleanupFixture(fixture)
  }
})

test('follows new messages only while the reader is at the latest message', async ({ browser }) => {
  let fixture: Fixture | null = null
  const firstContext = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const secondContext = await browser.newContext({ viewport: { width: 1280, height: 720 } })

  try {
    fixture = await createFixture()
    const { error: seedError } = await fixture.admin.from('messages').insert(
      Array.from({ length: 50 }, (_, index) => ({
        channel_id: fixture!.channelId,
        sender_id: fixture!.first.userId,
        body: `scroll-history-${String(index + 1).padStart(2, '0')} ${'message '.repeat(30)}`,
      })),
    )
    if (seedError) throw seedError

    const firstPage = await openChannel(firstContext, fixture.channelId, fixture.first.loginId)
    const secondPage = await openChannel(secondContext, fixture.channelId, fixture.second.loginId)
    const firstScrollArea = firstPage.locator('[data-conversation-message-pane] .overflow-y-auto').first()

    const ownMessage = `own-follow-${Date.now()}`
    await firstPage.getByLabel('메시지 입력').fill(ownMessage)
    await firstPage.locator('[data-send-message]').click()
    await expect(firstPage.getByText(ownMessage, { exact: true })).toHaveCount(1, { timeout: 10_000 })
    await expect.poll(
      () => firstScrollArea.evaluate((element) =>
        Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) <= 2,
      ),
      { timeout: 5_000 },
    ).toBe(true)

    const remoteMessage = `remote-follow-${Date.now()}`
    await secondPage.getByLabel('메시지 입력').fill(remoteMessage)
    await secondPage.locator('[data-send-message]').click()
    await expect(firstPage.getByText(remoteMessage, { exact: true })).toHaveCount(1, { timeout: 10_000 })
    await expect.poll(
      () => firstScrollArea.evaluate((element) =>
        Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) <= 2,
      ),
      { timeout: 5_000 },
    ).toBe(true)

    await firstScrollArea.evaluate((element) => {
      element.scrollTop = 0
    })
    await expect.poll(() => firstScrollArea.evaluate((element) => element.scrollTop)).toBeLessThanOrEqual(2)

    const remoteWhileReadingHistory = `remote-stay-${Date.now()}`
    await secondPage.getByLabel('메시지 입력').fill(remoteWhileReadingHistory)
    await secondPage.locator('[data-send-message]').click()
    await expect(firstPage.getByText(remoteWhileReadingHistory, { exact: true })).toHaveCount(1, { timeout: 10_000 })

    await expect.poll(
      () => firstScrollArea.evaluate((element) => element.scrollTop),
      { timeout: 5_000 },
    ).toBeLessThanOrEqual(2)
    await expect.poll(
      () => firstScrollArea.evaluate((element) =>
        element.scrollHeight - element.clientHeight - element.scrollTop,
      ),
      { timeout: 5_000 },
    ).toBeGreaterThan(20)
  } finally {
    await firstContext.close()
    await secondContext.close()
    await cleanupFixture(fixture)
  }
})