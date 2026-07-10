export type ExportFormat = 'csv' | 'json'

export function buildExportUrl(
  projectId: number,
  format: ExportFormat,
  from?: string,
  to?: string,
): string {
  const params = new URLSearchParams({ format })
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  return `/api/projects/${projectId}/export?${params.toString()}`
}
