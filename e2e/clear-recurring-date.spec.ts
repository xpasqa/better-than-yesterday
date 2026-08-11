import { test, expect } from './fixtures.ts'

// Closes the riskiest unverified item from issue #24: clearing the due date
// on a recurring task. sanitizeNode (packages/core/src/node.ts) exists
// specifically because dueDate=null with recurrence still set violates the
// DB's node_recur_needs_date CHECK — and since the outbox pushes as one
// batch, one row that slips past the guard blocks sync for the user
// permanently (issue #83 §1). This had never been clicked in a real browser
// before this test.
test('clearing the due date on a recurring task does not break sync', async ({ page, userEmail: _userEmail }) => {
  await page.goto('/today')
  await page.getByRole('main').getByRole('button', { name: /add task/i }).click()

  const input = page.getByLabel('Quick add a task')
  await input.fill('bayar listrik setiap bulan')
  await input.press('Enter')

  const createSyncPromise = page.waitForResponse((r) => r.url().includes('/api/sync') && r.ok())
  await expect(page.getByText('bayar listrik')).toBeVisible()
  await createSyncPromise

  await page.getByText('bayar listrik').click()
  await page.getByRole('button', { name: 'Due date' }).click()
  await page.getByRole('button', { name: 'Clear date' }).click()

  // If sanitizeNode's guard failed, this write would 422/500 and sync would
  // report offline — waitForResponse's `r.ok()` filter makes that failure
  // surface as a timeout instead of a false pass.
  const clearSyncPromise = page.waitForResponse((r) => r.url().includes('/api/sync') && r.ok())
  await page.getByRole('button', { name: 'Close' }).click()
  await clearSyncPromise

  // A task with no due date no longer qualifies for Today — it moves to
  // Anytime. Reload proves the cleared state (and the still-live sync loop)
  // survived the round trip to Postgres, not just Dexie.
  await page.reload()
  await page.goto('/anytime')
  await page.getByText('bayar listrik').click()
  await expect(page.getByRole('button', { name: 'Due date' })).toHaveText('Add date')
})
