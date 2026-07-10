import { describe, expect, it } from 'vitest'
import { buildExportUrl } from './export'

describe('buildExportUrl', () => {
  it('builds a csv url with no time range', () => {
    expect(buildExportUrl(5, 'csv')).toBe('/api/projects/5/export?format=csv')
  })

  it('builds a json url with no time range', () => {
    expect(buildExportUrl(5, 'json')).toBe('/api/projects/5/export?format=json')
  })

  it('includes from param when provided', () => {
    const url = buildExportUrl(3, 'csv', '2026-07-01T00:00:00Z')
    expect(url).toContain('from=2026-07-01T00%3A00%3A00Z')
  })

  it('includes both from and to params when provided', () => {
    const url = buildExportUrl(3, 'json', '2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z')
    expect(url).toContain('from=')
    expect(url).toContain('to=')
  })
})
