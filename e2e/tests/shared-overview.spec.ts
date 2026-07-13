import { test, expect, type Browser, type Page } from '@playwright/test'

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`
}

async function registerAndLogin(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page.getByText(`Hi, ${email}`)).toBeVisible()
  return page
}

test('a shared project overview sums all members time and can be filtered to one user', async ({
  browser,
}) => {
  const ownerEmail = uniqueEmail()
  const memberEmail = uniqueEmail()

  const ownerPage = await registerAndLogin(browser, ownerEmail)
  const memberPage = await registerAndLogin(browser, memberEmail)

  const ownerProjects = ownerPage
    .locator('section')
    .filter({ has: ownerPage.getByRole('heading', { name: 'Projects' }) })
  await ownerProjects.getByLabel('New project').fill('Shared work')
  await ownerProjects.getByRole('button', { name: 'Add project' }).click()
  await expect(ownerProjects.getByRole('list', { name: 'Project list' })).toContainText(
    'Shared work',
  )

  await ownerProjects.getByRole('button', { name: 'Members' }).click()
  await ownerProjects.getByPlaceholder('Invite by email').fill(memberEmail)
  await ownerProjects.getByRole('button', { name: 'Invite' }).click()
  await expect(ownerProjects.getByRole('list', { name: 'Members list' })).toContainText(
    memberEmail,
  )

  const ownerAddTaskForm = ownerPage
    .locator('form')
    .filter({ has: ownerPage.getByRole('button', { name: 'Add task' }) })
  await ownerAddTaskForm.getByLabel('Description').fill('Owner work')
  await ownerAddTaskForm.getByLabel('Start').fill('2026-01-01T09:00')
  await ownerAddTaskForm.getByLabel('End').fill('2026-01-01T10:00')
  await ownerAddTaskForm.getByLabel('Shared work').check()
  await ownerAddTaskForm.getByRole('button', { name: 'Add task' }).click()
  await expect(ownerPage.getByRole('cell', { name: 'Owner work' })).toBeVisible()

  await memberPage.reload()
  const memberAddTaskForm = memberPage
    .locator('form')
    .filter({ has: memberPage.getByRole('button', { name: 'Add task' }) })
  await memberAddTaskForm.getByLabel('Description').fill('Member work')
  await memberAddTaskForm.getByLabel('Start').fill('2026-01-02T09:00')
  await memberAddTaskForm.getByLabel('End').fill('2026-01-02T11:00')
  await memberAddTaskForm.getByLabel('Shared work').check()
  await memberAddTaskForm.getByRole('button', { name: 'Add task' }).click()
  await expect(memberPage.getByRole('cell', { name: 'Member work' })).toBeVisible()

  // The owner's overview, unfiltered, sums both users' time: 1h + 2h = 3h.
  await ownerPage.reload()
  const overviewSection = ownerPage
    .locator('section')
    .filter({ has: ownerPage.getByRole('heading', { name: 'Overview', exact: true }) })
  await overviewSection.getByLabel('Project').selectOption('Shared work')
  await overviewSection.getByRole('button', { name: 'Show' }).click()

  await expect(overviewSection.getByText('Owner work')).toBeVisible()
  await expect(overviewSection.getByText('Member work')).toBeVisible()
  await expect(overviewSection.getByText('03:00:00')).toBeVisible()

  // Filtering by the member narrows the total down to just their 2h task.
  await overviewSection.getByLabel('Filter by user').selectOption(memberEmail)
  await overviewSection.getByRole('button', { name: 'Show' }).click()

  await expect(overviewSection.getByText('Member work')).toBeVisible()
  await expect(overviewSection.getByText('Owner work')).not.toBeVisible()
  await expect(overviewSection.getByText('02:00:00')).toBeVisible()
})
