import { test, expect } from './fixtures.ts'

// docs/feature/34.sidebar-workspace/spec.md §3, §6 — the sidebar's new
// grouping. The full Recent-Chats chain (send chat → title appears → click →
// history renders) needs a live LLM backend, so it's covered by the API
// integration tests (agent-sessions.test.ts) plus manual browser
// verification instead of e2e.

test('sidebar groups: Todo on top, Workspace quarantined below projects', async ({ page, userEmail: _userEmail }) => {
  const sidebar = page.getByRole('complementary')

  // The six Things views live in the top nav list, unlabeled.
  for (const label of ['Inbox', 'Today', 'Upcoming', 'Anytime', 'Someday', 'Logbook']) {
    await expect(sidebar.getByRole('button', { name: label, exact: false }).first()).toBeVisible()
  }

  // The Workspace section exists and holds the modules — including Tags.
  await expect(sidebar.getByText('Workspace', { exact: true })).toBeVisible()
  for (const label of ['Outline', 'Mail', 'Storage', 'Finance', 'Agent', 'Tags']) {
    await expect(sidebar.getByRole('button', { name: label, exact: true })).toBeVisible()
  }

  // Workspace comes AFTER My Projects in document order (spec §3: projects
  // sit right under the Things views, modules below them).
  const order = await sidebar.evaluate((el) => {
    const titles = [...el.querySelectorAll('.sidebar__section-title')].map((t) => t.textContent)
    return titles
  })
  expect(order.indexOf('My Projects')).toBeLessThan(order.indexOf('Workspace'))

  // No sessions yet — Recent Chats must not render at all.
  expect(order).not.toContain('Recent Chats')
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
