import { test, expect } from '@playwright/test'

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`
}

test('a task can be tagged, tags show up, and filtering by tag narrows the list', async ({
  page,
}) => {
  const email = uniqueEmail()
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page.getByText(`Hi, ${email}`)).toBeVisible()

  const addForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Add task' }) })
  await addForm.getByLabel('Description').fill('Tagged entry')
  await addForm.getByLabel('Start').fill('2026-01-01T09:00')
  await addForm.getByLabel('End').fill('2026-01-01T10:00')
  await addForm.getByLabel('Tags (comma-separated)').fill('work, urgent')
  await addForm.getByRole('button', { name: 'Add task' }).click()

  await expect(page.getByText('Tagged entry')).toBeVisible()
  await expect(page.getByText('work')).toBeVisible()
  await expect(page.getByText('urgent')).toBeVisible()

  await addForm.getByLabel('Description').fill('Untagged entry')
  await addForm.getByLabel('Start').fill('2026-01-02T09:00')
  await addForm.getByLabel('End').fill('2026-01-02T10:00')
  await addForm.getByRole('button', { name: 'Add task' }).click()
  await expect(page.getByText('Untagged entry')).toBeVisible()

  await page.getByLabel('Filter by tag').fill('work')
  await expect(page.getByText('Tagged entry')).toBeVisible()
  await expect(page.getByText('Untagged entry')).not.toBeVisible()

  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(page.getByText('Untagged entry')).toBeVisible()
})
