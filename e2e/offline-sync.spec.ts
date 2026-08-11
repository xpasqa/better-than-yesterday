import { test, expect } from './fixtures.ts'

test('a task created offline reaches the server once sync is allowed again', async ({ page, context, userEmail: _userEmail }) => {
  await page.goto('/today')

  // Block sync at the network layer — avoids needing Docker privileges.
  await context.route('**/api/sync', (route) => route.abort())

  await page.getByRole('main').getByRole('button', { name: /add task/i }).click()
  const input = page.getByLabel('Quick add a task')
  await input.fill('task saat offline')
  await input.press('Enter')

  // Offline-first: must be visible immediately, from Dexie.
  await expect(page.getByText('task saat offline')).toBeVisible()

  // Unblock sync, then wait for the next successful round trip.
  // sync-client.ts runs startSyncLoop (5 s interval) and triggerSync (400 ms
  // debounce) — triggering a small navigation ensures triggerSync fires
  // immediately rather than waiting the full 5 s interval.
  await context.unroute('**/api/sync')

  // A tiny navigation (reload current page) triggers the sync loop on mount
  // and flushes the outbox without navigating away.
  const syncResponsePromise = page.waitForResponse(
    (r) => r.url().includes('/api/sync') && r.ok(),
    { timeout: 15_000 },
  )

  // Navigate to trigger a fresh sync on mount
  await page.goto('/today')

  await syncResponsePromise

  // Reload reads from the server: if the outbox never drained, this fails.
  await page.reload()
  await expect(page.getByText('task saat offline')).toBeVisible()
})
