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

async function login(page: Page, loginId: string) {
  await page.goto('/chats/login')
  await page.getByLabel('아이디').fill(loginId)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(/\/chats$/)
}

async function openChannel(context: BrowserContext, channelId: string, loginId: string) {
  const page = await context.newPage()
  page.on('pageerror', (error) => console.log(`[pageerror:${loginId}] ${error.stack ?? error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      console.log(`[console:${loginId}:${message.type()}] ${message.text()}`)
    }
  })

  await login(page, loginId)
  await page.goto(`/chats/channel/${channelId}`)
  await expect(page.locator('[data-channel-message-pane]')).toBeVisible()
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

    // Give both authenticated clients a moment to join their Realtime subscriptions.
    await secondPage.waitForTimeout(750)

    const original = `hello-${Date.now()}`
    const firstInput = firstPage.getByLabel('메시지 입력')
    const firstSend = firstPage.locator('[data-send-message]')
    await firstInput.fill(original)
    await expect(firstInput).toHaveValue(original)

    const composerSnapshot = await firstPage.evaluate(() => {
      const input = document.querySelector<HTMLTextAreaElement>('#keychats-message-input')
      const send = document.querySelector<HTMLButtonElement>('[data-send-message]')
      return {
        inputValue: input?.value ?? null,
        inputDisabled: input?.disabled ?? null,
        sendDisabled: send?.disabled ?? null,
        sendText: send?.textContent ?? null,
        panePresent: Boolean(document.querySelector('[data-channel-message-pane]')),
      }
    })
    console.log(`[composer-snapshot] ${JSON.stringify(composerSnapshot)}`)

    await expect(firstSend).toBeEnabled({ timeout: 5_000 })
    await firstSend.click()
    await expect(secondPage.getByText(original, { exact: true })).toBeVisible({ timeout: 10_000 })

    const firstArticleOnSecond = secondPage.locator('article').filter({ hasText: original })
    await firstArticleOnSecond.hover()
    await firstArticleOnSecond.getByRole('button', { name: '답글' }).click()

    const reply = `reply-${Date.now()}`
    await secondPage.getByLabel('메시지 입력').fill(reply)
    await secondPage.locator('[data-send-message]').click()
    await expect(firstPage.getByText(reply, { exact: true })).toBeVisible({ timeout: 10_000 })

    const firstArticle = firstPage.locator('article').filter({ hasText: original })
    await firstArticle.hover()
    await firstArticle.getByRole('button', { name: '수정' }).click()

    const edited = `${original}-edited`
    await firstPage.getByLabel('메시지 입력').fill(edited)
    await firstPage.locator('[data-send-message]').click()

    const editedOnSecond = secondPage.locator('article').filter({ hasText: edited }).first()
    await expect(editedOnSecond).toContainText('(수정됨)', { timeout: 10_000 })

    const editedOnFirst = firstPage.locator('article').filter({ hasText: edited }).first()
    await editedOnFirst.hover()
    await editedOnFirst.getByRole('button', { name: '삭제' }).click()

    await expect(secondPage.getByText('삭제된 메시지입니다.', { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    })
    await expect(secondPage.getByText(edited, { exact: true })).toHaveCount(0)
  } finally {
    await firstContext.close()
    await secondContext.close()
    await cleanupFixture(fixture)
  }
})
