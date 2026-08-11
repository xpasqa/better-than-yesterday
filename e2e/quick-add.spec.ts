import { test, expect } from './fixtures.ts'

test('quick-add lands in Today with the parsed date, then completes', async ({ page, userEmail: _userEmail }) => {
  await page.goto('/today')
  await page.getByRole('main').getByRole('button', { name: /add task/i }).click()

  const input = page.getByLabel('Quick add a task')
  await input.fill('beli tiket pesawat hari ini jam 9 !1')
  await input.press('Enter')

  const row = page.getByText('beli tiket pesawat')
  await expect(row).toBeVisible()
  await expect(page.getByText('09:00')).toBeVisible()

  // Reload proves it survived the round trip to Postgres, not just Dexie —
  // but only once that round trip has actually happened. triggerSync()
  // debounces 400ms, so wait for the confirmed response before reloading;
  // otherwise the reload races the push and only proves Dexie was correct.
  await page.waitForResponse((r) => r.url().includes('/api/sync') && r.ok())
  await page.reload()
  await expect(page.getByText('beli tiket pesawat')).toBeVisible()

  const completeSyncPromise = page.waitForResponse((r) => r.url().includes('/api/sync') && r.ok())
  await page.getByRole('button', { name: /mark beli tiket pesawat as complete/i }).click()
  await expect(page.getByText('beli tiket pesawat')).toBeHidden()
  await completeSyncPromise
})

// Closes the recurring-advance verification that was blocking #23 in Review (issue #24).
test('a recurring task advances instead of closing', async ({ page, userEmail: _userEmail }) => {
  await page.goto('/today')
  await page.getByRole('main').getByRole('button', { name: /add task/i }).click()

  const input = page.getByLabel('Quick add a task')
  await input.fill('siram tanaman setiap hari')
  await input.press('Enter')

  await expect(page.getByText('siram tanaman')).toBeVisible()
  const completeSyncPromise = page.waitForResponse((r) => r.url().includes('/api/sync') && r.ok())
  await page.getByRole('button', { name: /mark siram tanaman as complete/i }).click()
  await completeSyncPromise

  // The whole point of recurrence: it does not disappear, its date advances.
  await page.reload()
  await expect(page.getByText('siram tanaman')).toBeHidden() // moved to tomorrow
  await page.goto('/upcoming')
  await expect(page.getByText('siram tanaman')).toBeVisible()
})
