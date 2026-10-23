import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test'

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

async function clickFirstVisible(locator: Locator) {
  const count = await locator.count()

  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index)
    if (await candidate.isVisible()) {
      await candidate.click()
      return
    }
  }

  throw new Error('VISIBLE_DM_CONTROL_NOT_FOUND')
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
  await expect(page).toHaveURL(/\/chats\/(?:channel\/[0-9a-f-]+|settings)$/)
}

async function startDm(context: BrowserContext, current: E2eUser, other: E2eUser) {
  const page = await context.newPage()
  await login(page, current)
  await clickFirstVisible(page.getByText('새 DM', { exact: true }))
  await clickFirstVisible(page.getByRole('button', { name: other.displayName, exact: true }))
  await expect(page).toHaveURL(/\/chats\/dm\/[0-9a-f-]+$/)
  const pane = page.locator('[data-dm-message-pane]')
  await expect(pane).toBeVisible()
  await expect(pane).toHaveAttribute('data-realtime-status', 'ready', { timeout: 12_000 })
  return page
}

test('keeps one canonical 1:1 DM private while syncing messages in realtime', async ({ browser }) => {
  test.setTimeout(60_000)

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

test('DM management safely handles empty selection, highlights checked rooms, and closes outside', async ({ browser }) => {
  test.setTimeout(60_000)

  let fixture: Fixture | null = null
  const context = await browser.newContext()

  try {
    fixture = await createFixture()
    const page = await startDm(context, fixture.first, fixture.second)

    await clickFirstVisible(page.getByText('DM 관리', { exact: true }))
    let panel = page.locator('[data-sidebar-popover="dm-management"]')
    await expect(panel).toBeVisible()

    const leaveButton = panel.getByRole('button', { name: '선택한 DM 나가기' })
    await expect(leaveButton).toBeDisabled()

    await panel.locator('form').evaluate((form: HTMLFormElement) => form.requestSubmit())
    await expect(page.getByText('This page couldn’t load')).toHaveCount(0)
    await expect(page).toHaveURL(/\/chats\/dm\/[0-9a-f-]+$/)

    const row = panel.locator('[data-dm-management-row]').filter({ hasText: fixture.second.displayName })
    const checkbox = row.locator('input[type="checkbox"]')
    await checkbox.check()
    await expect(row).toHaveAttribute('data-selected', 'true')
    await expect(leaveButton).toBeEnabled()

    await clickFirstVisible(page.getByText('KEYCHATS', { exact: true }))
    await expect(panel).toHaveCount(0)

    await clickFirstVisible(page.getByText('DM 관리', { exact: true }))
    panel = page.locator('[data-sidebar-popover="dm-management"]')
    await expect(panel).toBeVisible()
  } finally {
    await context.close()
    await cleanupFixture(fixture)
  }
})
