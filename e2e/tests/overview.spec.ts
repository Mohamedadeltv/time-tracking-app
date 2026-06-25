import { test, expect } from '@playwright/test'

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

test('the project overview includes a subproject task and rolls up its total', async ({
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

  await projectsSection.getByLabel('New project').fill('Child')
  await projectsSection.getByLabel('Parent project').selectOption('Parent')
  await projectsSection.getByRole('button', { name: 'Add project' }).click()
  await expect(projectList.getByText('Child')).toBeVisible()

  const addTaskForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Add task' }) })
  await addTaskForm.getByLabel('Description').fill('On child')
  await addTaskForm.getByLabel('Start').fill('2026-01-01T08:00')
  await addTaskForm.getByLabel('End').fill('2026-01-01T10:00')
  await addTaskForm.getByLabel('Child').check()
  await addTaskForm.getByRole('button', { name: 'Add task' }).click()
  await expect(page.getByRole('cell', { name: 'Child', exact: true })).toBeVisible()

  const overviewSection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Overview', exact: true }) })
  await overviewSection.getByLabel('Project').selectOption('Parent')
  await overviewSection.getByRole('button', { name: 'Show' }).click()

  // The task is only tagged to the child, but viewing the parent must still show it and roll up
  // its 2 hours into the parent's total - the "incl. subprojects" requirement.
  await expect(overviewSection.getByText('On child')).toBeVisible()
  await expect(overviewSection.getByText('02:00:00')).toBeVisible()
})

test('the period overview shows tasks tracked today with their total time', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page.getByText(`Hi, ${email}`)).toBeVisible()

  const now = new Date()
  const start = new Date(now.getTime() - 2 * 60 * 60 * 1000)
  const end = new Date(now.getTime() - 1 * 60 * 60 * 1000)

  const addTaskForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Add task' }) })
  await addTaskForm.getByLabel('Description').fill('Tracked today')
  await addTaskForm.getByLabel('Start').fill(toLocalInputValue(start))
  await addTaskForm.getByLabel('End').fill(toLocalInputValue(end))
  await addTaskForm.getByRole('button', { name: 'Add task' }).click()
  await expect(page.getByRole('cell', { name: 'Tracked today' })).toBeVisible()

  const overviewSection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Overview', exact: true }) })
  await overviewSection.getByRole('button', { name: 'Today' }).click()

  await expect(overviewSection.getByText('Tracked today')).toBeVisible()
  await expect(overviewSection.getByText('01:00:00')).toBeVisible()
})
