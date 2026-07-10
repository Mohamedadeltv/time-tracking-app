import { describe, expect, it } from 'vitest'
import {
  addOneMonth,
  formatInTimezone,
  startOfDayInTimezone,
  startOfMonthInTimezone,
} from './timezone'

describe('formatInTimezone', () => {
  it('formats a UTC timestamp in the given timezone', () => {
    const result = formatInTimezone('2026-07-10T10:00:00Z', 'UTC')
    expect(result).toContain('Jul')
    expect(result).toContain('10')
    expect(result).toContain('2026')
  })

  it('uses browser timezone when no timezone provided', () => {
    const result = formatInTimezone('2026-07-10T10:00:00Z')
    expect(result).toBeTruthy()
  })

  it('uses browser timezone when null is provided', () => {
    const result = formatInTimezone('2026-07-10T10:00:00Z', null)
    expect(result).toBeTruthy()
  })
})

describe('startOfDayInTimezone', () => {
  it('returns a Date at midnight in the given timezone', () => {
    const start = startOfDayInTimezone('UTC')
    const utcHour = start.getUTCHours()
    const utcMinutes = start.getUTCMinutes()
    expect(utcHour).toBe(0)
    expect(utcMinutes).toBe(0)
  })

  it('returns a Date representing the start of today in UTC+0', () => {
    const start = startOfDayInTimezone('UTC')
    expect(start.getTime()).toBeLessThanOrEqual(Date.now())
  })
})

describe('startOfMonthInTimezone', () => {
  it('returns a date on the first of the month in UTC', () => {
    const start = startOfMonthInTimezone('UTC')
    const dateStr = start.toISOString().slice(0, 10)
    expect(dateStr).toMatch(/^\d{4}-\d{2}-01$/)
  })
})

describe('addOneMonth', () => {
  it('advances to the next month', () => {
    const jan1 = new Date(Date.UTC(2026, 0, 1)) // Jan 1, 2026
    const result = addOneMonth(jan1, 'UTC')
    const dateStr = result.toISOString().slice(0, 10)
    expect(dateStr).toBe('2026-02-01')
  })

  it('wraps December to January of the next year', () => {
    const dec1 = new Date(Date.UTC(2026, 11, 1)) // Dec 1, 2026
    const result = addOneMonth(dec1, 'UTC')
    const dateStr = result.toISOString().slice(0, 10)
    expect(dateStr).toBe('2027-01-01')
  })
})
