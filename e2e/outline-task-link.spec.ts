import { test, expect } from './fixtures.ts'

// Full chain from docs/feature/32.outline-task-decoupling/spec.md §10: a
// plain Outline row never pollutes Todo, #project + the popup is the only
// way it grows a task, and the two stay linked but independent afterward.
//
// Project names here are single tokens on purpose — the `#` sigil parser
// (packages/core/src/parse.ts) stops matching at the first non-letter
// character, so "#E2E Liburan" would only capture "E2E" and leave " Liburan"
// dangling in the title. That's a real constraint of quick-add's `#project`
// syntax everywhere, not something this test works around.
//
// Every `page.goto()` below is a hard browser navigation, not an in-app
// route change — the local-first write it follows (Dexie is written
// fire-and-forget, see outline-actions.ts's enqueueNode) must be confirmed
// visible in the DOM first, or the navigation can interrupt the IndexedDB
// transaction before it lands and the assertion after reload finds nothing.

async function createProject(page: import('@playwright/test').Page, name: string): Promise<void> {
  // "Add project or area" lives in the Projects secondary panel now
  // (35.project-secondary-panel), not the primary sidebar.
  await page.getByRole('complementary').getByRole('button', { name: 'Projects', exact: true }).click()
  await page.getByRole('button', { name: 'Add project or area' }).click()
  await page.getByRole('menuitem', { name: 'New Project' }).click()
  await page.getByPlaceholder('Project name').fill(name)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  // Confirms the create-project write landed before any hard navigation.
  await expect(page.getByRole('dialog', { name: 'Add project' })).toBeHidden()
}

test('an Outline row stays out of Anytime until #project links it to a real task', async ({ page, userEmail: _userEmail }) => {
  await createProject(page, 'E2ELiburan')

  await page.goto('/outline')
  await page.getByRole('button', { name: /add item/i }).click()
  const newRowInput = page.locator('.outline-node__input')
  await newRowInput.fill('Beli tiket pesawat')
  await newRowInput.press('Enter')
  // Confirms the content write landed before any hard navigation.
  await expect(page.getByText('Beli tiket pesawat', { exact: true })).toBeVisible()

  // Committing the sentence must never touch Anytime — this is the bug the
  // whole feature exists to fix.
  await page.goto('/anytime')
  await expect(page.getByText(/0 tasks/i)).toBeVisible()

  // Back to the row, now link it.
  await page.goto('/outline')
  await page.getByText('Beli tiket pesawat', { exact: true }).click()
  const rowInput = page.locator('.outline-node__input')
  await rowInput.press('End')
  await rowInput.pressSequentially(' #E2ELiburan')
  await expect(page.locator('.outline-node__project-option', { hasText: 'E2ELiburan' })).toBeVisible()
  await page.locator('.outline-node__project-option', { hasText: 'E2ELiburan' }).click()

  const dialog = page.getByRole('dialog', { name: /link task/i })
  await expect(dialog).toBeVisible()
  // The token typed to reach the dropdown must already be stripped from the
  // pre-filled title (spec §4 step 2) — not merely present.
  await expect(page.locator('#ltm-title-input')).toHaveValue('Beli tiket pesawat')

  await dialog.getByRole('button', { name: 'Add' }).click()
  await expect(dialog).toBeHidden()

  // The task now exists in the project, and only the task shows in Anytime
  // — the Outline sentence that spawned it still doesn't get counted twice.
  await page.goto('/anytime')
  await expect(page.getByText(/1 task\b/i)).toBeVisible()
  await expect(page.getByText('Beli tiket pesawat')).toBeVisible()

  // Complete it from Outline; the task's own status (visible via Anytime)
  // must follow, proving the checkbox on a linked row drives the real task,
  // not the Outline sentence.
  await page.goto('/outline')
  await page.getByRole('button', { name: 'Toggle complete' }).click()
  await expect(page.locator('.outline-node--completed')).toBeVisible()

  await page.goto('/anytime')
  await expect(page.getByText(/0 tasks/i)).toBeVisible()
})

test('cancelling the link popup writes nothing', async ({ page, userEmail: _userEmail }) => {
  await createProject(page, 'E2ECancelProject')

  await page.goto('/outline')
  await page.getByRole('button', { name: /add item/i }).click()
  const rowInput = page.locator('.outline-node__input')
  await rowInput.fill('Catatan batal #E2ECancelProject')
  await expect(page.locator('.outline-node__project-option', { hasText: 'E2ECancelProject' })).toBeVisible()
  await page.locator('.outline-node__project-option', { hasText: 'E2ECancelProject' }).click()

  const dialog = page.getByRole('dialog', { name: /link task/i })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()

  // The sentence — sigil and all — is untouched, and no task was created.
  // The row is still focused (cancelling the popup doesn't blur it), so its
  // text lives in the input's value, not as rendered text content.
  await expect(rowInput).toHaveValue('Catatan batal #E2ECancelProject')
  await expect(page.getByRole('button', { name: 'Toggle complete' })).toHaveCount(0)

  await page.goto('/anytime')
  await expect(page.getByText(/0 tasks/i)).toBeVisible()
})
