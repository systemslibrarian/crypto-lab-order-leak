import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4201/crypto-lab-order-leak/', colorScheme: 'dark' },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4627 --strictPort',
    url: 'http://localhost:4201/crypto-lab-order-leak/',
    reuseExistingServer: !process.env.CI,
  },
})