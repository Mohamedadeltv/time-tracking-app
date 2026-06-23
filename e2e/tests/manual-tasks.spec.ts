import { test, expect } from '@playwright/test'

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`
}

test('a task can be added with explicit times, edited, and deleted', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page.getByText(`Hi, ${email}`)).toBeVisible()

  const addForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Add task' }) })
  await addForm.getByLabel('Description').fill('Manual entry')
  await addForm.getByLabel('Start').fill('2026-01-01T09:00')
  await addForm.getByLabel('End').fill('2026-01-01T10:00')
  await addForm.getByRole('button', { name: 'Add task' }).click()

  await expect(page.getByText('Manual entry')).toBeVisible()

  await page.getByRole('button', { name: 'Edit' }).click()
  const editForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save' }) })
  await editForm.getByLabel('Description').fill('Corrected entry')
  await editForm.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByText('Corrected entry')).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete' }).click()

  await expect(page.getByText('No tasks yet.')).toBeVisible()
})

test('adding a task with an end time before the start time is rejected', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page.getByText(`Hi, ${email}`)).toBeVisible()

  const addForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Add task' }) })
  await addForm.getByLabel('Start').fill('2026-01-01T10:00')
  await addForm.getByLabel('End').fill('2026-01-01T09:00')
  await addForm.getByRole('button', { name: 'Add task' }).click()

  await expect(page.getByText('End time must be after start time')).toBeVisible()
})
