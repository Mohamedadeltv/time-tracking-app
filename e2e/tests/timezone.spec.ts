import { test, expect, type Browser, type Page } from '@playwright/test'

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

async function expectedFormat(page: Page, iso: string, timezone: string): Promise<string> {
  return page.evaluate(
    ({ iso, timezone }) =>
      new Date(iso).toLocaleString(undefined, {
        timeZone: timezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    { iso, timezone },
  )
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

async function setTimezone(page: Page, timezone: string) {
  const timezoneForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Apply timezone' }) })
  await timezoneForm.getByLabel('Timezone').fill(timezone)
  await timezoneForm.getByRole('button', { name: 'Apply timezone' }).click()
  await expect(timezoneForm.getByText('Timezone saved.')).toBeVisible()
}

test('changing the preferred timezone changes how task times are displayed', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page.getByText(`Hi, ${email}`)).toBeVisible()

  const taskStart = new Date('2026-06-15T12:00:00Z')
  const taskEnd = new Date(taskStart.getTime() + 60 * 60 * 1000)

  const addTaskForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Add task' }) })
  await addTaskForm.getByLabel('Description').fill('Zoned task')
  await addTaskForm.getByLabel('Start').fill(toLocalInputValue(taskStart))
  await addTaskForm.getByLabel('End').fill(toLocalInputValue(taskEnd))
  await addTaskForm.getByRole('button', { name: 'Add task' }).click()
  await expect(page.getByRole('cell', { name: 'Zoned task' })).toBeVisible()

  const taskRow = page.getByRole('row', { name: /Zoned task/ })

  await setTimezone(page, 'UTC')
  const utcExpected = await expectedFormat(page, taskStart.toISOString(), 'UTC')
  await expect(taskRow.locator('td').nth(1)).toHaveText(utcExpected)

  // Pacific/Kiritimati is UTC+14 with no DST, so the displayed date/time must shift forward.
  await setTimezone(page, 'Pacific/Kiritimati')
  const plus14Expected = await expectedFormat(page, taskStart.toISOString(), 'Pacific/Kiritimati')
  await expect(taskRow.locator('td').nth(1)).toHaveText(plus14Expected)
  expect(plus14Expected).not.toBe(utcExpected)
})

test('collaborators on a shared project each see task times in their own timezone', async ({
  browser,
}) => {
  test.setTimeout(60_000)
  const ownerEmail = uniqueEmail()
  const memberEmail = uniqueEmail()

  const ownerPage = await registerAndLogin(browser, ownerEmail)
  const memberPage = await registerAndLogin(browser, memberEmail)

  await setTimezone(ownerPage, 'UTC')
  await setTimezone(memberPage, 'Pacific/Kiritimati')

  const ownerProjects = ownerPage
    .locator('section')
    .filter({ has: ownerPage.getByRole('heading', { name: 'Projects' }) })
  await ownerProjects.getByLabel('New project').fill('Zoned project')
  await ownerProjects.getByRole('button', { name: 'Add project' }).click()
  await expect(ownerProjects.getByRole('list', { name: 'Project list' })).toContainText(
    'Zoned project',
  )
  await ownerProjects.getByRole('button', { name: 'Members' }).click()
  await ownerProjects.getByPlaceholder('Invite by email').fill(memberEmail)
  await ownerProjects.getByRole('button', { name: 'Invite' }).click()
  await expect(ownerProjects.getByRole('list', { name: 'Members list' })).toContainText(
    memberEmail,
  )

  const taskStart = new Date('2026-06-15T12:00:00Z')
  const taskEnd = new Date(taskStart.getTime() + 60 * 60 * 1000)
  const ownerAddTaskForm = ownerPage
    .locator('form')
    .filter({ has: ownerPage.getByRole('button', { name: 'Add task' }) })
  await ownerAddTaskForm.getByLabel('Description').fill('Shared zoned task')
  await ownerAddTaskForm.getByLabel('Start').fill(toLocalInputValue(taskStart))
  await ownerAddTaskForm.getByLabel('End').fill(toLocalInputValue(taskEnd))
  await ownerAddTaskForm.getByLabel('Zoned project').check()
  await ownerAddTaskForm.getByRole('button', { name: 'Add task' }).click()
  await expect(ownerPage.getByRole('cell', { name: 'Shared zoned task' })).toBeVisible()

  const ownerOverview = ownerPage
    .locator('section')
    .filter({ has: ownerPage.getByRole('heading', { name: 'Overview', exact: true }) })
  await ownerOverview.getByLabel('Project').selectOption('Zoned project')
  await ownerOverview.getByRole('button', { name: 'Show' }).click()
  const ownerExpected = await expectedFormat(ownerPage, taskStart.toISOString(), 'UTC')
  await expect(ownerOverview.getByText(ownerExpected)).toBeVisible()

  await memberPage.reload()
  const memberOverview = memberPage
    .locator('section')
    .filter({ has: memberPage.getByRole('heading', { name: 'Overview', exact: true }) })
  await memberOverview.getByLabel('Project').selectOption('Zoned project')
  await memberOverview.getByRole('button', { name: 'Show' }).click()
  const memberExpected = await expectedFormat(
    memberPage,
    taskStart.toISOString(),
    'Pacific/Kiritimati',
  )
  await expect(memberOverview.getByText(memberExpected)).toBeVisible()
  expect(memberExpected).not.toBe(ownerExpected)
})
