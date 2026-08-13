import { test, expect } from './fixtures.ts'

// docs/feature/34.sidebar-workspace/spec.md §3, §6 — the sidebar's new
// grouping. The full Recent-Chats chain (send chat → title appears → click →
// history renders) needs a live LLM backend, so it's covered by the API
// integration tests (agent-sessions.test.ts) plus manual browser
// verification instead of e2e.
//
// docs/feature/35.project-secondary-panel/spec.md — Favorites and My
// Projects moved out of the primary sidebar into a single "Projects" row
// (updated here too), which opens a secondary panel mirroring MailView's
// folder column.

test('sidebar groups: Todo on top, Projects as one row, Workspace quarantined below', async ({ page, userEmail: _userEmail }) => {
  const sidebar = page.getByRole('complementary')

  // The six Things views plus the single "Projects" row live in the top nav
  // list, unlabeled.
  for (const label of ['Inbox', 'Today', 'Upcoming', 'Projects', 'Anytime', 'Someday', 'Logbook']) {
    await expect(sidebar.getByRole('button', { name: label, exact: false }).first()).toBeVisible()
  }

  // Favorites and My Projects no longer live inline in the primary sidebar.
  await expect(sidebar.getByText('My Projects', { exact: true })).toBeHidden()

  // The Workspace section exists and holds the modules. Tags moved into
  // Settings (36.tags-in-settings) — it's not a Workspace row anymore.
  await expect(sidebar.getByText('Workspace', { exact: true })).toBeVisible()
  for (const label of ['Outline', 'Mail', 'Storage', 'Finance', 'Agent']) {
    await expect(sidebar.getByRole('button', { name: label, exact: true })).toBeVisible()
  }
  await expect(sidebar.getByRole('button', { name: 'Tags', exact: true })).toHaveCount(0)

  // No sessions yet — Recent Chats must not render at all.
  const order = await sidebar.evaluate((el) => [...el.querySelectorAll('.sidebar__section-title')].map((t) => t.textContent))
  expect(order).not.toContain('Recent Chats')
})

test('clicking Projects opens the secondary panel, mirroring MailView\'s folder column', async ({ page, userEmail: _userEmail }) => {
  const sidebar = page.getByRole('complementary')
  await sidebar.getByRole('button', { name: 'Projects', exact: true }).click()

  const panel = page.locator('.project-list-panel')
  await expect(panel.getByText('My Projects', { exact: true })).toBeVisible()
  await expect(page.getByText('Select a project')).toBeVisible()
})

test('Tags lives inside Settings, not the sidebar (36.tags-in-settings)', async ({ page, userEmail: _userEmail }) => {
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Tags', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
  await expect(page.getByText('No tags yet.')).toBeVisible()
})

test('workspace fold persists across reload', async ({ page, userEmail: _userEmail }) => {
  const sidebar = page.getByRole('complementary')
  await expect(sidebar.getByRole('button', { name: 'Outline', exact: true })).toBeVisible()

  // Collapse Workspace via its chevron (the section-header's collapse button).
  const workspaceHeader = sidebar.locator('.sidebar__section-header', { hasText: 'Workspace' })
  await workspaceHeader.getByRole('button', { name: 'Collapse' }).click()
  await expect(sidebar.getByRole('button', { name: 'Outline', exact: true })).toBeHidden()

  await page.reload()
  await expect(sidebar.getByText('Workspace', { exact: true })).toBeVisible()
  await expect(sidebar.getByRole('button', { name: 'Outline', exact: true })).toBeHidden()

  // Restore for other tests sharing this user.
  await workspaceHeader.getByRole('button', { name: 'Expand' }).click()
  await expect(sidebar.getByRole('button', { name: 'Outline', exact: true })).toBeVisible()
})
