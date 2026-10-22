import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const password = 'E2eKeychats!2026'

type E2eUser = {
  loginId: string
  userId: string
  displayName: string
}

type Fixture = {
  admin: SupabaseClient
  first: E2eUser
  second: E2eUser
  outsider: E2eUser
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

  const createUser = async (
    prefix: string,
    displayName: string,
    role: 'member' | 'admin' = 'member',
  ): Promise<E2eUser> => {
    const loginId = `${prefix}_${suffix}`.slice(0, 24)
    const { data, error } = await admin.auth.admin.createUser({
      email: `${loginId}@auth.keychats.invalid`,
      password,
      email_confirm: true,
      app_metadata: { role },
    })
    if (error || !data.user) throw error ?? new Error('E2E_USER_CREATE_FAILED')

    const { error: profileError } = await admin.from('profiles').insert({
      user_id: data.user.id,
      username: loginId,
      display_name: displayName,
      status: 'active',
    })
    if (profileError) throw profileError

    return { loginId, userId: data.user.id, displayName }
  }

  return {
    admin,
    first: await createUser('dm_a', `DM Alpha ${suffix}`),
    second: await createUser('dm_b', `DM Beta ${suffix}`),
    outsider: await createUser('dm_c', `DM Admin ${suffix}`, 'admin'),
  }
}

async function cleanupFixture(fixture: Fixture | null) {
  if (!fixture) return

  await fixture.admin
    .from('dm_threads')
    .delete()
    .or(
      `user_low.in.(${fixture.first.userId},${fixture.second.userId},${fixture.outsider.userId}),user_high.in.(${fixture.first.userId},${fixture.second.userId},${fixture.outsider.userId})`,
    )

  await fixture.admin.auth.admin.deleteUser(fixture.first.userId)
  await fixture.admin.auth.admin.deleteUser(fixture.second.userId)
  await fixture.admin.auth.admin.deleteUser(fixture.outsider.userId)
}

async function login(page: Page, user: E2eUser) {
  await page.goto('/chats/login')
  await page.getByLabel('아이디').fill(user.loginId)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(/\/chats$/)
}

async function startDm(context: BrowserContext, current: E2eUser, other: E2eUser) {
  const page = await context.newPage()
  await login(page, current)
  await page.getByText('새 DM', { exact: true }).first().click()
  await page.getByRole('button', { name: other.displayName, exact: true }).first().click()
  await expect(page).toHaveURL(/\/chats\/dm\/[0-9a-f-]+$/)
  const pane = page.locator('[data-dm-message-pane]')
  await expect(pane).toBeVisible()
  await expect(pane).toHaveAttribute('data-realtime-status', 'subscribed', { timeout: 10_000 })
  return page
}

test('keeps one canonical 1:1 DM private while syncing messages in realtime', async ({ browser }) => {
  let fixture: Fixture | null = null
  const firstContext = await browser.newContext()
  const secondContext = await browser.newContext()
  const outsiderContext = await browser.newContext()

  try {
    fixture = await createFixture()

    const firstPage = await startDm(firstContext, fixture.first, fixture.second)
    const threadUrl = firstPage.url()
    const threadId = threadUrl.split('/').pop()
    expect(threadId).toBeTruthy()

    const secondPage = await startDm(secondContext, fixture.second, fixture.first)
    expect(secondPage.url()).toBe(threadUrl)

    const outsiderPage = await outsiderContext.newPage()
    await login(outsiderPage, fixture.outsider)
    const response = await outsiderPage.goto(`/chats/dm/${threadId}`)
    expect(response?.status()).toBe(404)
    await expect(outsiderPage.locator('[data-dm-message-pane]')).toHaveCount(0)

    const body = `private-${Date.now()}`
    await firstPage.getByLabel('메시지 입력').fill(body)
    await firstPage.locator('[data-send-message]').click()
    await expect(secondPage.getByText(body, { exact: true })).toBeVisible({ timeout: 10_000 })
  } finally {
    await firstContext.close()
    await secondContext.close()
    await outsiderContext.close()
    await cleanupFixture(fixture)
  }
})
