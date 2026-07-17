import { test, expect, type Browser, type Page } from '@playwright/test'

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`
}

// Formats a Date as the wall-clock `datetime-local` value it corresponds to in the given
// timezone, mirroring the app's own toDateTimeLocalValue conversion. Used so tests can fill
// task Start/End inputs with the exact string a user in that timezone would have typed.
function toLocalInputValueInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  const hour = get('hour') === '24' ? '00' : get('hour')
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
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

async function registerAndLogin(browser: Browser, email: string, timezoneId?: string): Promise<Page> {
  const context = await browser.newContext(timezoneId ? { timezoneId } : {})
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
  await timezoneForm.getByLabel('Timezone').selectOption(timezone)
  await timezoneForm.getByRole('button', { name: 'Apply timezone' }).click()
  await expect(timezoneForm.getByText('Timezone saved.')).toBeVisible()
}

// Pin the browser's own OS timezone away from UTC so these tests genuinely exercise "task
// creation uses the user's preferred app timezone, not the browser's timezone" - rather than
// passing by coincidence when the CI host happens to already run in UTC.
test.use({ timezoneId: 'America/New_York' })

test('changing the preferred timezone changes how task times are displayed', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page.getByText(`Hi, ${email}`)).toBeVisible()

  // Set the preferred timezone to UTC *before* creating the task, so the Start/End inputs
  // (filled with the UTC wall-clock value) are interpreted as UTC by the app - exercising the
  // "creating a new task uses this timezone by default" requirement, not just display.
  await setTimezone(page, 'UTC')

  const taskStart = new Date('2026-06-15T12:00:00Z')
  const taskEnd = new Date(taskStart.getTime() + 60 * 60 * 1000)

  const addTaskForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Add task' }) })
  await addTaskForm.getByLabel('Description').fill('Zoned task')
  await addTaskForm.getByLabel('Start').fill(toLocalInputValueInTimezone(taskStart, 'UTC'))
  await addTaskForm.getByLabel('End').fill(toLocalInputValueInTimezone(taskEnd, 'UTC'))
  await addTaskForm.getByRole('button', { name: 'Add task' }).click()
  await expect(page.getByRole('cell', { name: 'Zoned task' })).toBeVisible()

  const taskRow = page.getByRole('row', { name: /Zoned task/ })

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

  // Owner's browser OS timezone is deliberately different from their UTC app preference below,
  // so the task-creation step below genuinely exercises the preferred-timezone interpretation.
  const ownerPage = await registerAndLogin(browser, ownerEmail, 'America/New_York')
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
  await ownerAddTaskForm.getByLabel('Start').fill(toLocalInputValueInTimezone(taskStart, 'UTC'))
  await ownerAddTaskForm.getByLabel('End').fill(toLocalInputValueInTimezone(taskEnd, 'UTC'))
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
