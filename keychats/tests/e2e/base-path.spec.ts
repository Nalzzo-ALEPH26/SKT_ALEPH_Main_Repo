import { expect, test } from '@playwright/test'

test('serves Keychats from /chats with deep links and static assets', async ({ page, request }) => {
  await page.goto('/chats')
  await expect(page.locator('[data-keychats-shell]')).toBeVisible()

  await page.getByRole('link', { name: '로그인' }).click()
  await expect(page).toHaveURL(/\/chats\/login$/)
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()

  const asset = await request.get('/chats/default-avatar.svg')
  expect(asset.ok()).toBe(true)
  expect(asset.headers()['content-type']).toContain('image/svg+xml')
})
