import type { WorkspaceData } from '../src/workspaceTypes.ts'

// Store repeated work-log field names once in code, while the API keeps named objects.
const fields = ['id', 'projectId', 'date', 'worker', 'workerType', 'startTime', 'endTime', 'overtimeHours', 'location', 'task', 'note', 'hours'] as const

export function unpackWorkLog(row: unknown): unknown {
  if (!Array.isArray(row)) return row
  if (row.length !== fields.length) throw new Error('작업일보 저장 형식을 확인하세요.')
  return Object.fromEntries(fields.map((key, index) => [key, row[index]]))
}

export function packWorkspace(data: WorkspaceData) {
  return { ...data, workLogs: data.workLogs.map(row => fields.map(key => row[key])) }
}
