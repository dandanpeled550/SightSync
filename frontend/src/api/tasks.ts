import api from './client'

export interface Task {
  id: number
  project_id: number
  name: string
  description: string | null
  level_tag: string
  trade_tag: string | null
  start_date: string
  duration_days: number
  end_date: string
  status: string
  source: string
  notes: string | null
}

export interface TaskLogEntry {
  id: number
  daily_log_id: number
  task_id: number
  action: string
  new_date: string | null
  reason: string | null
}

export interface CascadeResult {
  task_id: number
  task_name: string
  old_start_date: string
  new_start_date: string
  old_end_date: string
  new_end_date: string
  days_shifted: number
}

export async function fetchTodayTasks(projectId: number): Promise<Task[]> {
  const res = await api.get<Task[]>(`/projects/${projectId}/tasks/today`)
  return res.data
}

export async function fetchAllTasks(projectId: number): Promise<Task[]> {
  const res = await api.get<Task[]>(`/projects/${projectId}/tasks`)
  return res.data
}

export async function markTaskDone(
  logId: number,
  taskId: number,
  reason?: string,
): Promise<TaskLogEntry> {
  const res = await api.post<TaskLogEntry>(`/daily-logs/${logId}/task-entries`, {
    task_id: taskId,
    action: 'done',
    reason: reason ?? null,
  })
  return res.data
}

export async function markTaskNotDone(
  logId: number,
  taskId: number,
  newDate: string,
  reason?: string,
): Promise<TaskLogEntry> {
  const res = await api.post<TaskLogEntry>(`/daily-logs/${logId}/task-entries`, {
    task_id: taskId,
    action: 'not_done',
    new_date: newDate,
    reason: reason ?? null,
  })
  return res.data
}

export async function fetchCascadePreview(
  taskId: number,
  newStartDate: string,
): Promise<CascadeResult[]> {
  const res = await api.post<CascadeResult[]>(`/tasks/${taskId}/cascade-preview`, {
    new_start_date: newStartDate,
  })
  return res.data
}

export interface ExtractionResult {
  tasks: ExtractedTask[]
  confidence: number
  error: string | null
  raw_text_length: number
}

export interface ExtractedTask {
  name: string
  level_tag: string
  trade_tag: string | null
  start_date: string   // "YYYY-MM-DD"
  duration_days: number
}

// Upload a .xlsx file; returns ExtractionResult (always 200, check .error field)
// Uses fetch instead of axios — axios's default Content-Type: application/json overrides
// FormData's multipart boundary, breaking the upload. fetch lets the browser set it correctly.
export async function uploadSchedule(file: File): Promise<ExtractionResult> {
  const form = new FormData()
  form.append('file', file)
  const baseURL = (api.defaults.baseURL ?? 'http://localhost:8000').replace(/\/$/, '')
  const response = await fetch(`${baseURL}/projects/1/upload-schedule`, {
    method: 'POST',
    body: form,
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail ?? 'Upload failed')
  }
  return response.json()
}

// Confirm extracted tasks — clears existing tasks and inserts these
export async function confirmSchedule(tasks: ExtractedTask[]): Promise<{ tasks_created: number }> {
  const { data } = await api.post<{ tasks_created: number }>(`/projects/1/confirm-schedule`, { tasks })
  return data
}
