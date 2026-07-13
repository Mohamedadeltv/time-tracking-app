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

test('an invited member can see and track time on a shared project, but an uninvited user cannot', async ({
  browser,
}) => {
  const ownerEmail = uniqueEmail()
  const memberEmail = uniqueEmail()
  const strangerEmail = uniqueEmail()

  const ownerPage = await registerAndLogin(browser, ownerEmail)
  const memberPage = await registerAndLogin(browser, memberEmail)
  const strangerPage = await registerAndLogin(browser, strangerEmail)

  const ownerProjects = ownerPage
    .locator('section')
    .filter({ has: ownerPage.getByRole('heading', { name: 'Projects' }) })
  const ownerProjectList = ownerProjects.getByRole('list', { name: 'Project list' })

  await ownerProjects.getByLabel('New project').fill('Shared work')
  await ownerProjects.getByRole('button', { name: 'Add project' }).click()
  await expect(ownerProjectList.getByText('Shared work')).toBeVisible()

  await ownerProjects.getByRole('button', { name: 'Members' }).click()
  await ownerProjects.getByPlaceholder('Invite by email').fill(memberEmail)
  await ownerProjects.getByRole('button', { name: 'Invite' }).click()
  await expect(ownerProjects.getByRole('list', { name: 'Members list' })).toContainText(
    memberEmail,
  )

  // The invited member sees the project after reloading and can track time on it.
  await memberPage.reload()
  const memberProjects = memberPage
    .locator('section')
    .filter({ has: memberPage.getByRole('heading', { name: 'Projects' }) })
  await expect(memberProjects.getByRole('list', { name: 'Project list' })).toContainText(
    'Shared work',
  )

  const memberAddTaskForm = memberPage
    .locator('form')
    .filter({ has: memberPage.getByRole('button', { name: 'Add task' }) })
  await memberAddTaskForm.getByLabel('Description').fill('Member work')
  await memberAddTaskForm.getByLabel('Start').fill('2026-01-01T09:00')
  await memberAddTaskForm.getByLabel('End').fill('2026-01-01T10:00')
  await memberAddTaskForm.getByLabel('Shared work').check()
  await memberAddTaskForm.getByRole('button', { name: 'Add task' }).click()
  await expect(memberPage.getByRole('cell', { name: 'Member work' })).toBeVisible()

  // A user who was never invited never sees the project at all.
  await strangerPage.reload()
  const strangerProjects = strangerPage
    .locator('section')
    .filter({ has: strangerPage.getByRole('heading', { name: 'Projects' }) })
  await expect(strangerProjects.getByText('No projects yet.')).toBeVisible()
  await expect(strangerProjects.getByText('Shared work')).not.toBeVisible()
})
