import { test, expect } from '@playwright/test'

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`
}

test('a user can register, log out, and log back in', async ({ page }) => {
  const email = uniqueEmail()
  const password = 'password123'

  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)

  await page.getByRole('link', { name: 'Register' }).click()
  await expect(page).toHaveURL(/\/register$/)

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Register' }).click()

  await expect(page.getByText(`Hi, ${email}`)).toBeVisible()

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()

  await expect(page.getByText(`Hi, ${email}`)).toBeVisible()
})

test('registration is rejected for an already-used email', async ({ page }) => {
  const email = uniqueEmail()
  const password = 'password123'

  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page.getByText(`Hi, ${email}`)).toBeVisible()

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.getByRole('link', { name: 'Register' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Register' }).click()

  await expect(page.getByText(/already in use/i)).toBeVisible()
})

test('login is rejected with the wrong password', async ({ page }) => {
  const email = uniqueEmail()
  const password = 'password123'

  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page.getByText(`Hi, ${email}`)).toBeVisible()

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('wrongPassword')
  await page.getByRole('button', { name: 'Log in' }).click()

  await expect(page.getByText('Invalid email or password')).toBeVisible()
})
