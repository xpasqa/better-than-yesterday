import { defineConfig } from '@playwright/test'

// Vite's actual dev port (apps/web/vite.config.ts) is 4200, not Vite's
// classic default of 5173 — and 3001 for the API is only free by
// convention, not guaranteed on every host. DEV_API_PORT lets both
// webServer entries agree on a port that's actually free on this machine.
const apiPort = process.env.DEV_API_PORT ?? '3011'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // one Postgres, shared state — parallel files would race
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run dev -w @better/api',
      port: Number(apiPort),
      // Reusing a server already listening on the port is convenient for
      // local iteration, but risks silently reusing something unrelated —
      // never do that in CI, where the environment is otherwise clean.
      reuseExistingServer: !process.env.CI,
      env: { PORT: apiPort },
    },
    {
      command: 'npm run dev -w @better/web',
      port: 4200,
      reuseExistingServer: !process.env.CI,
      env: { DEV_API_PORT: apiPort },
    },
  ],
})
