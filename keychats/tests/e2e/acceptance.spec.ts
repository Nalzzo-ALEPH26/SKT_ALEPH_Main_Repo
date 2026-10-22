import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test, type Page } from '@playwright/test'

const password = 'E2eKeychats!2026'

type TestUser = {
  loginId: string
  userId: string
  displayName: string
}

function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`E2E_ENV_MISSING:${name}`)
  return value
}

function createAdminClient() {
  return createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('SUPABASE_SECRET_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

async function createUser(
  admin: SupabaseClient,
  input: { loginId: string; displayName: string; role?: 'admin' | 'member' },
): Promise<TestUser> {
  const { data, error } = await admin.auth.admin.createUser({
    email: `${input.loginId}@auth.keychats.invalid`,
    password,
    email_confirm: true,
    app_metadata: { role: input.role ?? 'member' },
  })
  if (error || !data.user) throw error ?? new Error('E2E_USER_CREATE_FAILED')

  const { error: profileError } = await admin.from('profiles').insert({
    user_id: data.user.id,
    username: input.loginId,
    display_name: input.displayName,
    status: 'active',
  })
  if (profileError) throw profileError

  return { loginId: input.loginId, userId: data.user.id, displayName: input.displayName }
}

async function createChannel(
  admin: SupabaseClient,
  input: {
    name: string
    createdBy: string
    members: Array<{ userId: string; role: 'owner' | 'member' }>
    isDefault?: boolean
  },
) {
  const { data, error } = await admin
    .from('channels')
    .insert({
      name: input.name,
      created_by: input.createdBy,
      is_default: input.isDefault ?? false,
    })
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('E2E_CHANNEL_CREATE_FAILED')

  const { error: membershipError } = await admin.from('channel_members').insert(
    input.members.map((member) => ({
      channel_id: data.id,
      user_id: member.userId,
      role: member.role,
    })),
  )
  if (membershipError) throw membershipError

  return data.id as string
}

async function login(page: Page, loginId: string) {
  await page.goto('/chats/login')
  await page.getByLabel('아이디').fill(loginId)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(/\/chats\/(?:channel\/[^/]+|settings|admin)/)
}

async function cleanupUsers(admin: SupabaseClient, users: TestUser[]) {
  for (const user of users) {
    await admin.auth.admin.deleteUser(user.userId)
  }
}

async function waitForReadState(
  admin: SupabaseClient,
  userId: string,
  channelId: string,
  messageId: number,
) {
  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from('read_states')
          .select('last_read_message_id')
          .eq('user_id', userId)
          .eq('channel_id', channelId)
          .is('dm_thread_id', null)
          .maybeSingle()
        return data?.last_read_message_id ?? null
      },
      { timeout: 10_000 },
    )
    .toBe(messageId)
}

async function waitForLiveAttachment(admin: SupabaseClient, messageId: number, expectedBody: string) {
  await expect
    .poll(
      async () => {
        const { data: message, error: messageError } = await admin
          .from('messages')
          .select('body,deleted_at')
          .eq('id', messageId)
          .maybeSingle()

        if (messageError) return `message-error:${messageError.message}`
        if (!message) return 'message-missing'
        if (message.deleted_at) return `message-deleted:${message.body ?? 'null'}`
        if (message.body !== expectedBody) return `message-body:${message.body ?? 'null'}`

        const { count, error: attachmentError } = await admin
          .from('attachments')
          .select('id', { count: 'exact', head: true })
          .eq('message_id', messageId)

        if (attachmentError) return `attachment-error:${attachmentError.message}`
        return `live-attachments:${count ?? 0}`
      },
      { timeout: 10_000 },
    )
    .toBe('live-attachments:1')
}

test('creates a member channel and covers attachment, reaction, pin, unread, theme and mobile drawer', async ({ browser }) => {
  const admin = createAdminClient()
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const users: TestUser[] = []
  const channelIds: string[] = []
  const firstContext = await browser.newContext()
  const secondContext = await browser.newContext()

  try {
    const first = await createUser(admin, {
      loginId: `accept_a_${suffix}`.slice(0, 24),
      displayName: 'Acceptance Alpha',
    })
    const second = await createUser(admin, {
      loginId: `accept_b_${suffix}`.slice(0, 24),
      displayName: 'Acceptance Beta',
    })
    users.push(first, second)

    const baseChannelId = await createChannel(admin, {
      name: `base-${suffix}`.slice(0, 80),
      createdBy: first.userId,
      members: [
        { userId: first.userId, role: 'owner' },
        { userId: second.userId, role: 'member' },
      ],
    })
    channelIds.push(baseChannelId)

    const firstPage = await firstContext.newPage()
    await login(firstPage, first.loginId)
    await firstPage.goto(`/chats/channel/${baseChannelId}`)

    const newChannelName = `accept-${suffix}`.slice(0, 80)
    const createDetails = firstPage.locator('details').filter({ hasText: '채널 만들기' }).first()
    await createDetails.locator('summary').click()
    await createDetails.getByLabel('채널 이름').fill(newChannelName)
    await createDetails.getByRole('checkbox', { name: /Acceptance Beta/ }).check()
    await createDetails.getByRole('button', { name: '만들기' }).click()

    const baseChannelUrl = `http://localhost:3000/chats/channel/${baseChannelId}`
    await expect.poll(() => firstPage.url(), { timeout: 10_000 }).not.toBe(baseChannelUrl)
    await expect(firstPage).toHaveURL(/\/chats\/channel\/[0-9a-f-]+$/)
    await expect(firstPage.getByRole('heading', { name: `#${newChannelName}` })).toBeVisible({
      timeout: 10_000,
    })

    const createdChannelId = firstPage.url().split('/').pop()
    expect(createdChannelId).toBeTruthy()
    expect(createdChannelId).not.toBe(baseChannelId)
    channelIds.push(createdChannelId!)
    await expect(firstPage.getByText('멤버 2명', { exact: true })).toBeVisible()
    await expect(firstPage.locator('[data-channel-message-pane]')).toHaveAttribute(
      'data-realtime-status',
      'ready',
      { timeout: 12_000 },
    )

    const secondPage = await secondContext.newPage()
    await login(secondPage, second.loginId)
    await secondPage.goto(`/chats/channel/${createdChannelId}`)
    await expect(secondPage.locator('[data-channel-message-pane]')).toHaveAttribute(
      'data-realtime-status',
      'ready',
      { timeout: 12_000 },
    )

    const richMessage = `rich-${Date.now()}`
    await firstPage.locator('input[type="file"][multiple]').setInputFiles({
      name: 'acceptance.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('keychats acceptance attachment'),
    })
    await expect(firstPage.locator('[data-selected-attachments]')).toContainText('acceptance.txt')

    const firstInput = firstPage.getByLabel('메시지 입력')
    const firstSend = firstPage.locator('[data-send-message]')
    await firstInput.fill(richMessage)
    await expect(firstInput).toHaveValue(richMessage)
    await expect(firstSend).toBeEnabled({ timeout: 5_000 })
    await firstSend.click()

    const firstArticle = firstPage.locator('article').filter({ hasText: richMessage }).first()
    await expect(firstArticle).toBeVisible({ timeout: 10_000 })
    const messageId = Number(await firstArticle.getAttribute('data-message-id'))
    expect(Number.isInteger(messageId)).toBe(true)

    await waitForLiveAttachment(admin, messageId, richMessage)
    await expect(firstArticle.getByRole('link', { name: /acceptance\.txt/ })).toBeVisible({
      timeout: 10_000,
    })

    const secondArticle = secondPage.locator(`article[data-message-id="${messageId}"]`)
    await expect(secondArticle).toContainText(richMessage, { timeout: 10_000 })
    await expect(secondArticle.getByRole('link', { name: /acceptance\.txt/ })).toBeVisible({ timeout: 10_000 })
    await waitForReadState(admin, second.userId, createdChannelId!, messageId)

    await firstArticle.hover()
    await firstArticle.getByRole('button', { name: '👍 반응' }).click()
    await expect(secondArticle.locator('[data-reaction-emoji="👍"]')).toContainText('1', {
      timeout: 10_000,
    })

    await firstArticle.hover()
    await firstArticle.locator('[data-toggle-pin]').click()
    await expect(secondArticle.locator('[data-message-pinned]')).toBeVisible({ timeout: 10_000 })

    const attachmentHref = await secondArticle
      .getByRole('link', { name: /acceptance\.txt/ })
      .getAttribute('href')
    expect(attachmentHref).toBeTruthy()
    const attachmentResponse = await secondContext.request.get(
      new URL(attachmentHref!, secondPage.url()).toString(),
    )
    expect(attachmentResponse.status()).toBe(200)
    expect(await attachmentResponse.text()).toBe('keychats acceptance attachment')

    await secondPage.goto('/chats/settings')

    const unreadMessage = `unread-${Date.now()}`
    await firstPage.getByLabel('메시지 입력').fill(unreadMessage)
    await firstPage.locator('[data-send-message]').click()
    const unreadArticle = firstPage.locator('article').filter({ hasText: unreadMessage }).first()
    await expect(unreadArticle).toBeVisible()
    const unreadMessageId = Number(await unreadArticle.getAttribute('data-message-id'))

    await secondPage.reload()
    const unreadChannelLink = secondPage
      .locator('aside:visible a')
      .filter({ hasText: `#${newChannelName}` })
      .first()
    await expect(unreadChannelLink.getByText('1', { exact: true })).toBeVisible()

    await secondPage.goto(`/chats/channel/${createdChannelId}`)
    await expect(secondPage.getByText(unreadMessage, { exact: true })).toBeVisible({ timeout: 10_000 })
    await waitForReadState(admin, second.userId, createdChannelId!, unreadMessageId)

    await secondPage.goto('/chats/settings')
    await secondPage.reload()
    const readChannelLink = secondPage
      .locator('aside:visible a')
      .filter({ hasText: `#${newChannelName}` })
      .first()
    await expect(readChannelLink.getByText('1', { exact: true })).toHaveCount(0)

    await secondPage.getByRole('button', { name: 'Dark' }).click()
    await expect(secondPage.locator('[data-keychats-workspace]')).toHaveAttribute('data-theme', 'dark')
    await secondPage.reload()
    await expect(secondPage.locator('[data-keychats-workspace]')).toHaveAttribute('data-theme', 'dark')

    await secondPage.setViewportSize({ width: 390, height: 844 })
    await secondPage.goto(`/chats/channel/${createdChannelId}`)
    const mobileMenu = secondPage.locator('[data-mobile-menu-trigger]')
    await expect(mobileMenu).toBeVisible()
    await mobileMenu.click()
    await expect(secondPage.locator('details.group aside')).toBeVisible()
  } finally {
    await firstContext.close()
    await secondContext.close()
    for (const channelId of channelIds.reverse()) {
      await admin.from('channels').delete().eq('id', channelId)
    }
    await cleanupUsers(admin, users)
  }
})

test('uses a one-time invite and immediately blocks a disabled member with an existing session', async ({ browser }) => {
  const admin = createAdminClient()
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const users: TestUser[] = []
  let generalChannelId: string | null = null
  let invitedUserId: string | null = null
  const adminContext = await browser.newContext()
  const memberContext = await browser.newContext()
  const reuseContext = await browser.newContext()

  try {
    const adminUser = await createUser(admin, {
      loginId: 'cxu1344',
      displayName: 'Acceptance Admin',
      role: 'admin',
    })
    users.push(adminUser)

    generalChannelId = await createChannel(admin, {
      name: 'general',
      createdBy: adminUser.userId,
      members: [{ userId: adminUser.userId, role: 'owner' }],
      isDefault: true,
    })

    const adminPage = await adminContext.newPage()
    await login(adminPage, adminUser.loginId)
    await adminPage.goto('/chats/admin')
    await expect(adminPage.getByRole('heading', { name: '관리자' })).toBeVisible()
    await adminPage.getByRole('button', { name: '새 초대 만들기' }).click()

    const inviteText = adminPage.getByText(/http:\/\/localhost:3000\/chats\/invite\//).first()
    await expect(inviteText).toBeVisible()
    const inviteUrl = (await inviteText.textContent())?.trim()
    expect(inviteUrl).toBeTruthy()

    const invitedLogin = `invite_${suffix}`.slice(0, 24)
    const memberPage = await memberContext.newPage()
    await memberPage.goto(inviteUrl!)
    await memberPage.getByLabel('아이디').fill(invitedLogin)
    await memberPage.getByLabel('표시 이름').fill('Invited Acceptance')
    await memberPage.getByLabel('비밀번호').fill(password)
    await memberPage.getByRole('button', { name: '계정 만들기' }).click()
    await expect(memberPage).toHaveURL(/\/chats\/login\?registered=1$/)

    const { data: invitedProfile, error: invitedProfileError } = await admin
      .from('profiles')
      .select('user_id')
      .eq('username', invitedLogin)
      .single()
    if (invitedProfileError || !invitedProfile) {
      throw invitedProfileError ?? new Error('INVITED_PROFILE_MISSING')
    }
    invitedUserId = invitedProfile.user_id as string

    await memberPage.getByLabel('아이디').fill(invitedLogin)
    await memberPage.getByLabel('비밀번호').fill(password)
    await memberPage.getByRole('button', { name: '로그인' }).click()
    await expect(memberPage).toHaveURL(`http://localhost:3000/chats/channel/${generalChannelId}`)

    const reusePage = await reuseContext.newPage()
    await reusePage.goto(inviteUrl!)
    await reusePage.getByLabel('아이디').fill(`reuse_${suffix}`.slice(0, 24))
    await reusePage.getByLabel('표시 이름').fill('Should Not Register')
    await reusePage.getByLabel('비밀번호').fill(password)
    await reusePage.getByRole('button', { name: '계정 만들기' }).click()
    await expect(
      reusePage.getByText('초대 링크가 유효하지 않거나 더 이상 사용할 수 없습니다.', {
        exact: true,
      }),
    ).toBeVisible()

    await adminPage.reload()
    const managedRow = adminPage
      .locator('div.flex.flex-wrap.items-center.justify-between.gap-3.py-4')
      .filter({ hasText: `@${invitedLogin}` })
      .first()
    await expect(managedRow).toBeVisible()
    adminPage.once('dialog', (dialog) => void dialog.accept())
    await managedRow.getByRole('button', { name: '비활성화' }).click()
    await expect(managedRow).toContainText('상태: disabled', { timeout: 10_000 })

    await memberPage.reload()
    await expect(memberPage).toHaveURL(/\/chats\/login$/)
  } finally {
    await adminContext.close()
    await memberContext.close()
    await reuseContext.close()
    if (generalChannelId) await admin.from('channels').delete().eq('id', generalChannelId)
    if (invitedUserId) await admin.auth.admin.deleteUser(invitedUserId)
    await cleanupUsers(admin, users)
  }
})
