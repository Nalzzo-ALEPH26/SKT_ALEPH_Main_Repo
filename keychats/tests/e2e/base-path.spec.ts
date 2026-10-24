import { expect, test } from '@playwright/test'

test('serves Keychats login directly from /chats with deep links and static assets', async ({ page, request }) => {
  await page.goto('/chats')

  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()
  await expect(page.getByLabel('아이디')).toBeVisible()
  await expect(page.getByLabel('비밀번호')).toBeVisible()
  await expect(page.getByRole('button', { name: '로그인' })).toBeVisible()
  await expect(page).toHaveURL(/\/chats\/?$/)

  const asset = await request.get('/chats/default-avatar.svg')
  expect(asset.ok()).toBe(true)
  expect(asset.headers()['content-type']).toContain('image/svg+xml')
})
