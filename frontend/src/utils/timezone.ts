function getUtcOffsetMs(timezone: string, date: Date): number {
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
  const tz = new Date(date.toLocaleString('en-US', { timeZone: timezone }))
  return tz.getTime() - utc.getTime()
}

function midnightInTimezone(year: number, month0: number, day: number, timezone: string): Date {
  const midnightUTC = new Date(Date.UTC(year, month0, day, 0, 0, 0))
  const noonUTC = new Date(Date.UTC(year, month0, day, 12, 0, 0))
  const offsetMs = getUtcOffsetMs(timezone, noonUTC)
  return new Date(midnightUTC.getTime() - offsetMs)
}

export function formatInTimezone(isoString: string, timezone?: string | null): string {
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  return new Date(isoString).toLocaleString(undefined, {
    timeZone: tz,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function startOfDayInTimezone(timezone: string): Date {
  const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone })
  const [year, month, day] = dateStr.split('-').map(Number)
  return midnightInTimezone(year, month - 1, day, timezone)
}

export function startOfWeekInTimezone(timezone: string): Date {
  const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone })
  const [year, month, day] = dateStr.split('-').map(Number)
  const localDate = new Date(year, month - 1, day)
  const daysSinceMonday = (localDate.getDay() + 6) % 7
  const mondayDay = day - daysSinceMonday
  const monday = new Date(year, month - 1, mondayDay)
  return midnightInTimezone(monday.getFullYear(), monday.getMonth(), monday.getDate(), timezone)
}

export function startOfMonthInTimezone(timezone: string): Date {
  const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone })
  const [year, month] = dateStr.split('-').map(Number)
  return midnightInTimezone(year, month - 1, 1, timezone)
}

export function addOneDay(date: Date): Date {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000)
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export function addOneMonth(date: Date, timezone: string): Date {
  const dateStr = date.toLocaleDateString('en-CA', { timeZone: timezone })
  const [year, month] = dateStr.split('-').map(Number)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  return midnightInTimezone(nextYear, nextMonth - 1, 1, timezone)
}

// Interprets a `datetime-local` input value (no timezone info) as wall-clock time in the given
// timezone, rather than the browser's own timezone - so a user whose preferred app timezone
// differs from their OS/browser timezone still gets the instant they actually typed.
export function fromDateTimeLocalValue(value: string, timezone?: string | null): string {
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const [datePart, timePart] = value.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  const naiveUTC = Date.UTC(year, month - 1, day, hour, minute, 0)
  const offsetMs = getUtcOffsetMs(tz, new Date(Date.UTC(year, month - 1, day, 12, 0, 0)))
  return new Date(naiveUTC - offsetMs).toISOString()
}

// Inverse of fromDateTimeLocalValue: formats an instant as the wall-clock datetime-local value it
// corresponds to in the given timezone.
export function toDateTimeLocalValue(isoString: string, timezone?: string | null): string {
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(isoString))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  const hour = get('hour') === '24' ? '00' : get('hour')
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}
