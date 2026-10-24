import { defineConfig, devices } from '@playwright/test'

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: isGitHubActions ? 1 : undefined,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: isGitHubActions ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000/chats',
    reuseExistingServer: false,
    timeout: 120000,
  },
})