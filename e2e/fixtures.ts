import { test as base, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'

// One user per test FILE, not per test: full isolation would be cleaner but
// much slower, and separate files already cannot see each other's data.
export const test = base.extend<{ userEmail: string }>({
  userEmail: async ({ page }, use, testInfo) => {
    // Derive a stable slug from the spec file path so all tests in the same
    // file share one user — faster than per-test isolation, safe because
    // separate files already cannot see each other's data.
    const fileSlug = testInfo.file.replace(/.*\//, '').replace(/\W+/g, '-').replace(/\.ts$/, '')
    const email = `e2e-${fileSlug}-${testInfo.workerIndex}@test.local`

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

    // Wait until we're inside the app — Today's "+ Add task" trigger is always
    // visible in its default (form-closed) state. Scoped to <main> because
    // Sidebar has its own "Add task" button with the same accessible name.
    await expect(page.getByRole('main').getByRole('button', { name: /add task/i })).toBeVisible()

    await use(email)
  },
})

export { expect }
