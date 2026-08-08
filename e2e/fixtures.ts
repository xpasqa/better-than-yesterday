import { test as base, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'

// One user per test FILE, not per test: full isolation would be cleaner but
// much slower, and separate files already cannot see each other's data.
export const test = base.extend<{ userEmail: string }>({
  userEmail: async ({ page }, use, testInfo) => {
    const email = `e2e-${testInfo.title.replace(/\W+/g, '-')}-${testInfo.workerIndex}@test.local`

    // `npm run user -- add <email> [name]` creates the user + seeds their
    // Inbox root. If the user already exists (second run), the script exits
    // with an error — we catch that and continue so tests are idempotent.
    try {
      execFileSync('npm', ['run', 'user', '--', 'add', email], {
        stdio: 'pipe',
        // Pipe the password to stdin — the script reads it interactively
        input: 'e2e-password\n',
      })
    } catch (err: unknown) {
      // "already exists" is expected on re-runs; any other error is real
      const stderr = err instanceof Error && 'stderr' in err
        ? String((err as NodeJS.ErrnoException & { stderr: Buffer }).stderr)
        : ''
      if (!stderr.includes('already') && !stderr.includes('duplicate') && !stderr.includes('unique')) {
        throw err
      }
    }

    // Log in via the UI
    await page.goto('/')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill('e2e-password')
    await page.getByRole('button', { name: /sign.?in/i }).click()

    // Wait until we're inside the app — QuickAddBar's "Add" button is always visible
    await expect(page.getByRole('button', { name: /^Add$/i })).toBeVisible()

    await use(email)
  },
})

export { expect }
