import { test, expect } from '@playwright/test'

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`
}

async function registerAndLand(page: import('@playwright/test').Page) {
  const email = uniqueEmail()
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page.getByText(`Hi, ${email}`)).toBeVisible()
}

test('starting a task persists across a page reload, and it can be stopped', async ({ page }) => {
  await registerAndLand(page)

  await page.getByLabel('What are you working on?').fill('Writing the report')
  await page.getByRole('button', { name: 'Start' }).click()

  await expect(page.getByText('Tracking: Writing the report')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()

  await page.reload()
  await expect(page.getByText('Tracking: Writing the report')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()

  await page.getByRole('button', { name: 'Stop' }).click()
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
})

test('a task can be started without a description', async ({ page }) => {
  await registerAndLand(page)

  await page.getByRole('button', { name: 'Start' }).click()

  await expect(page.getByText('Tracking: Untitled task')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()
})
