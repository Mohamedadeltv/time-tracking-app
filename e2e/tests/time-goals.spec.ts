import { test, expect } from '@playwright/test'

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

test('setting daily and weekly goals shows progress on the overview panel', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page.getByText(`Hi, ${email}`)).toBeVisible()

  const goalsForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Save goals' }) })
  await goalsForm.getByLabel('Daily goal (hours)').fill('1')
  await goalsForm.getByLabel('Weekly goal (hours)').fill('10')
  await goalsForm.getByRole('button', { name: 'Save goals' }).click()
  await expect(goalsForm.getByText('Goals saved.')).toBeVisible()

  const now = new Date()
  const start = new Date(now.getTime() - 2 * 60 * 60 * 1000)

  const addTaskForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Add task' }) })
  await addTaskForm.getByLabel('Description').fill('Deep work')
  await addTaskForm.getByLabel('Start').fill(toLocalInputValue(start))
  await addTaskForm.getByLabel('End').fill(toLocalInputValue(now))
  await addTaskForm.getByRole('button', { name: 'Add task' }).click()
  await expect(page.getByRole('cell', { name: 'Deep work' })).toBeVisible()

  const overviewSection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Overview', exact: true }) })

  // The 2h task clears the 1h daily goal but not the 10h weekly goal.
  await expect(overviewSection.getByRole('heading', { name: 'Time goals' })).toBeVisible()
  await expect(overviewSection.getByText(/Today:/)).toBeVisible()
  await expect(overviewSection.getByText(/This week:/)).toBeVisible()
  await expect(overviewSection.getByText('Goal reached')).toBeVisible()
})

test('leaving a goal field blank clears it and hides its progress bar', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page.getByText(`Hi, ${email}`)).toBeVisible()

  const goalsForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Save goals' }) })
  const overviewSection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Overview', exact: true }) })

  await goalsForm.getByLabel('Daily goal (hours)').fill('2')
  await goalsForm.getByRole('button', { name: 'Save goals' }).click()
  await expect(goalsForm.getByText('Goals saved.')).toBeVisible()
  await expect(overviewSection.getByText(/Today:/)).toBeVisible()
  await expect(overviewSection.getByText(/This week:/)).not.toBeVisible()

  await goalsForm.getByLabel('Daily goal (hours)').fill('')
  await goalsForm.getByRole('button', { name: 'Save goals' }).click()
  await expect(goalsForm.getByText('Goals saved.')).toBeVisible()
  await expect(overviewSection.getByRole('heading', { name: 'Time goals' })).not.toBeVisible()
})
