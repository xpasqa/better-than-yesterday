import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // one Postgres, shared state — parallel files would race
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run dev -w @better/api',
      port: 3001,
      reuseExistingServer: true,
      env: { PORT: '3001' },
    },
    {
      command: 'npm run dev -w @better/web',
      port: 5173,
      reuseExistingServer: true,
    },
  ],
})
