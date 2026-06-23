import { test, expect } from '@playwright/test'

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`
}

test('a subproject rolls up its tracked time to its parent, deduplicating a shared task', async ({
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

  await projectsSection.getByLabel('New project').fill('Parent')
  await projectsSection.getByRole('button', { name: 'Add project' }).click()
  await expect(projectList.getByText('Parent')).toBeVisible()

  await projectsSection.getByLabel('New project').fill('Child A')
  await projectsSection.getByLabel('Parent project').selectOption('Parent')
  await projectsSection.getByRole('button', { name: 'Add project' }).click()
  await expect(projectList.getByText('Child A')).toBeVisible()

  await projectsSection.getByLabel('New project').fill('Child B')
  await projectsSection.getByLabel('Parent project').selectOption('Parent')
  await projectsSection.getByRole('button', { name: 'Add project' }).click()
  await expect(projectList.getByText('Child B')).toBeVisible()

  const addTaskForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Add task' }) })
  await addTaskForm.getByLabel('Start').fill('2026-01-01T08:00')
  await addTaskForm.getByLabel('End').fill('2026-01-01T10:00')
  await addTaskForm.getByLabel('Child A').check()
  await addTaskForm.getByLabel('Child B').check()
  await addTaskForm.getByRole('button', { name: 'Add task' }).click()

  await expect(page.getByRole('cell', { name: 'Child A, Child B' })).toBeVisible()

  const parentRow = projectList.locator('li', { hasText: 'Parent' }).locator('> div').first()
  const childARow = projectList.locator('li', { hasText: 'Child A' }).locator('> div').first()
  const childBRow = projectList.locator('li', { hasText: 'Child B' }).locator('> div').first()

  // The task is 2 hours long and tagged to both subprojects, so the parent's total must still be
  // 2 hours (not 4) - this is the multi-subproject de-duplication rule from the requirements.
  await expect(parentRow).toContainText('(02:00:00)')
  await expect(childARow).toContainText('(02:00:00)')
  await expect(childBRow).toContainText('(02:00:00)')
})
