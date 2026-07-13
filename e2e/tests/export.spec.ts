import { test, expect } from '@playwright/test'

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`
}

test('a project export can be downloaded as CSV or JSON with the task data', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page.getByText(`Hi, ${email}`)).toBeVisible()

  const projectsSection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Projects' }) })
  await projectsSection.getByLabel('New project').fill('Export me')
  await projectsSection.getByRole('button', { name: 'Add project' }).click()
  await expect(
    projectsSection.getByRole('list', { name: 'Project list' }),
  ).toContainText('Export me')

  const addTaskForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Add task' }) })
  await addTaskForm.getByLabel('Description').fill('Exported task')
  await addTaskForm.getByLabel('Start').fill('2026-01-01T09:00')
  await addTaskForm.getByLabel('End').fill('2026-01-01T10:00')
  await addTaskForm.getByLabel('Export me').check()
  await addTaskForm.getByRole('button', { name: 'Add task' }).click()
  await expect(page.getByRole('cell', { name: 'Exported task' })).toBeVisible()

  const overviewSection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Overview', exact: true }) })
  await overviewSection.getByLabel('Project').selectOption('Export me')

  // CSV export: rows include start/end time, project(s), and user.
  const [csvDownload] = await Promise.all([
    page.waitForEvent('download'),
    overviewSection.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(csvDownload.suggestedFilename()).toBe('Export_me-tasks.csv')
  const csvPath = await csvDownload.path()
  const csvContent = await (await import('node:fs/promises')).readFile(csvPath as string, 'utf-8')
  expect(csvContent).toContain('startTime,endTime,durationSeconds,description,projects,user')
  expect(csvContent).toContain('Exported task')
  expect(csvContent).toContain('Export me')
  expect(csvContent).toContain(email)
  expect(csvContent).toContain('3600')

  // JSON export: same data, machine-readable.
  await overviewSection.getByLabel('Export format').selectOption('json')
  const [jsonDownload] = await Promise.all([
    page.waitForEvent('download'),
    overviewSection.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(jsonDownload.suggestedFilename()).toBe('Export_me-tasks.json')
  const jsonPath = await jsonDownload.path()
  const jsonContent = await (await import('node:fs/promises')).readFile(
    jsonPath as string,
    'utf-8',
  )
  const rows = JSON.parse(jsonContent)
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({
    description: 'Exported task',
    durationSeconds: 3600,
    projects: ['Export me'],
    user: email,
  })
})

test('export can be limited to a specific month', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page.getByText(`Hi, ${email}`)).toBeVisible()

  const projectsSection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Projects' }) })
  await projectsSection.getByLabel('New project').fill('Monthly')
  await projectsSection.getByRole('button', { name: 'Add project' }).click()
  await expect(
    projectsSection.getByRole('list', { name: 'Project list' }),
  ).toContainText('Monthly')

  const addTaskForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Add task' }) })
  await addTaskForm.getByLabel('Description').fill('January task')
  await addTaskForm.getByLabel('Start').fill('2026-01-15T09:00')
  await addTaskForm.getByLabel('End').fill('2026-01-15T10:00')
  await addTaskForm.getByLabel('Monthly').check()
  await addTaskForm.getByRole('button', { name: 'Add task' }).click()
  await expect(page.getByRole('cell', { name: 'January task' })).toBeVisible()

  await addTaskForm.getByLabel('Description').fill('February task')
  await addTaskForm.getByLabel('Start').fill('2026-02-15T09:00')
  await addTaskForm.getByLabel('End').fill('2026-02-15T10:00')
  await addTaskForm.getByLabel('Monthly').check()
  await addTaskForm.getByRole('button', { name: 'Add task' }).click()
  await expect(page.getByRole('cell', { name: 'February task' })).toBeVisible()

  const overviewSection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Overview', exact: true }) })
  await overviewSection.getByLabel('Project').selectOption('Monthly')
  await overviewSection.getByLabel('Export period').selectOption('month')
  await overviewSection.getByLabel('Export year').fill('2026')
  await overviewSection.getByLabel('Export month').fill('1')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    overviewSection.getByRole('button', { name: 'Download' }).click(),
  ])
  const path = await download.path()
  const content = await (await import('node:fs/promises')).readFile(path as string, 'utf-8')
  expect(content).toContain('January task')
  expect(content).not.toContain('February task')
})
