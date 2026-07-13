import { test, expect } from '@playwright/test'

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`
}

test('a project can be created, associated with a task, then unassigned, then deleted', async ({
  page,
}) => {
  const email = uniqueEmail()
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page.getByText(`Hi, ${email}`)).toBeVisible()

  const projectsSection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Projects' }) })
  const projectList = projectsSection.getByRole('list', { name: 'Project list' })
  await projectsSection.getByLabel('New project').fill('Lecture')
  await projectsSection.getByRole('button', { name: 'Add project' }).click()
  await expect(projectList.getByText('Lecture')).toBeVisible()

  const addTaskForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Add task' }) })
  await addTaskForm.getByLabel('Description').fill('Manual entry')
  await addTaskForm.getByLabel('Start').fill('2026-01-01T09:00')
  await addTaskForm.getByLabel('End').fill('2026-01-01T10:00')
  await addTaskForm.getByLabel('Lecture').check()
  await addTaskForm.getByRole('button', { name: 'Add task' }).click()

  await expect(page.getByRole('cell', { name: 'Lecture' })).toBeVisible()

  await page.getByRole('button', { name: 'Edit' }).click()
  const editForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Save', exact: true }) })
  await editForm.getByLabel('Lecture').uncheck()
  await editForm.getByRole('button', { name: 'Save', exact: true }).click()

  const taskRow = page.getByRole('row', { name: /Manual entry/ })
  await expect(taskRow.locator('td').nth(3)).toHaveText('—')
  await expect(page.getByText('Manual entry')).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await projectsSection.getByRole('button', { name: 'Delete' }).click()
  await expect(projectsSection.getByText('No projects yet.')).toBeVisible()
})

test('a project can be renamed, and a duplicate name is rejected', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page.getByText(`Hi, ${email}`)).toBeVisible()

  const projectsSection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Projects' }) })
  const projectList = projectsSection.getByRole('list', { name: 'Project list' })
  await projectsSection.getByLabel('New project').fill('Lecture')
  await projectsSection.getByRole('button', { name: 'Add project' }).click()
  await expect(projectList.getByText('Lecture')).toBeVisible()

  await projectsSection.getByRole('button', { name: 'Rename' }).click()
  await projectsSection.getByLabel('Project name').fill('Seminar')
  await projectsSection.getByRole('button', { name: 'Save' }).click()
  await expect(projectList.getByText('Seminar')).toBeVisible()

  await projectsSection.getByLabel('New project').fill('Seminar')
  await projectsSection.getByRole('button', { name: 'Add project' }).click()
  await expect(projectsSection.getByText('Project name already in use: Seminar')).toBeVisible()
})
