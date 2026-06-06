import api from './client'

export interface Task {
  id: number
  project_id: number
  name: string
  description: string | null
  level_tag: string
  trade_tag: string | null
  apartment_tag: string | null
  room_tag: string | null
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
  cascade_results: CascadeResult[]
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

export interface CascadeDelayImpact {
  task_id: number | null
  task_name: string
  old_start_date: string
  new_start_date: string
  days_shifted: number
  is_root: boolean
}

export interface DelayGroup {
  triggering_entry_id: number
  trigger_task_id: number | null
  trigger_task_name: string
  reason: string | null
  old_date: string | null
  new_date: string
  days_shifted: number | null
  impacts: CascadeDelayImpact[]
}

export async function fetchDelays(logId: number): Promise<DelayGroup[]> {
  const res = await api.get<DelayGroup[]>(`/daily-logs/${logId}/delays`)
  return res.data
}

export async function fetchTaskEntries(logId: number): Promise<TaskLogEntry[]> {
  const res = await api.get<TaskLogEntry[]>(`/daily-logs/${logId}/task-entries`)
  return res.data
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
  opts?: { reason?: string; photo_url?: string },
): Promise<TaskLogEntry> {
  const res = await api.post<TaskLogEntry>(`/daily-logs/${logId}/task-entries`, {
    task_id: taskId,
    action: 'done',
    reason: opts?.reason ?? null,
    photo_url: opts?.photo_url ?? null,
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

export interface Workflow {
  id: string          // "wf_0", "wf_1", ...
  name: string        // e.g. "Electrical", "Structural"
  task_indices: number[]  // ordered task indices in this workflow
}

export interface InferredDependency {
  task_index: number
  depends_on_index: number
  lag_days: number
  confidence: number
  reasoning: string
  type: 'intra_workflow' | 'cross_workflow_handoff'
}

export interface ExtractionResult {
  tasks: ExtractedTask[]
  workflows: Workflow[]              // may be empty if Pass 2 unavailable
  dependencies: InferredDependency[] // may be empty
  confidence: number
  error: string | null
  raw_text_length: number
}

export interface ExtractedTask {
  name: string
  level_tag: string
  trade_tag: string | null
  apartment_tag: string | null
  room_tag: string | null
  start_date: string   // "YYYY-MM-DD"
  duration_days: number
}

// Upload a .xlsx file; returns ExtractionResult (always 200, check .error field)
// Uses fetch instead of axios — axios's default Content-Type: application/json overrides
// FormData's multipart boundary, breaking the upload. fetch lets the browser set it correctly.
export async function uploadSchedule(file: File, projectId: number): Promise<ExtractionResult> {
  const token = localStorage.getItem('auth_token')
  const form = new FormData()
  form.append('file', file)
  let baseURL = (api.defaults.baseURL ?? 'http://localhost:8000').replace(/\/$/, '')
  // Guard: Render's property:host gives "https://..." but property:url can give a bare
  // hostname or service name with no scheme. A schemeless value becomes a relative URL
  // in fetch(), hitting the static site instead of the API.
  if (baseURL && !baseURL.startsWith('http')) baseURL = `https://${baseURL}`
  const url = `${baseURL}/projects/${projectId}/upload-schedule`
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
  } catch (networkErr) {
    const msg = networkErr instanceof Error ? networkErr.message : String(networkErr)
    throw new Error(`Network error (${url}): ${msg}`)
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '(no body)')
    throw new Error(`HTTP ${response.status} from ${url}: ${body}`)
  }
  const text = await response.text()
  if (!text.trim()) {
    throw new Error(`Empty body — status=${response.status} url=${url}`)
  }
  try {
    return JSON.parse(text) as ExtractionResult
  } catch {
    throw new Error(`Non-JSON 200 from backend: ${text.slice(0, 300)}`)
  }
}

export interface TaskDependency {
  id: number
  task_id: number
  depends_on_task_id: number
  lag_days: number
}

export async function fetchTaskDependencies(projectId: number): Promise<TaskDependency[]> {
  const res = await api.get<TaskDependency[]>(`/projects/${projectId}/task-dependencies`)
  return res.data
}

export async function createTask(
  projectId: number,
  body: {
    name: string
    level_tag: string
    trade_tag?: string | null
    start_date: string
    duration_days: number
    description?: string | null
    notes?: string | null
  },
): Promise<Task> {
  const { data } = await api.post<Task>(`/projects/${projectId}/tasks`, {
    ...body,
    source: 'manual',
    status: 'pending',
  })
  return data
}

export async function createDependency(
  projectId: number,
  taskId: number,
  dependsOnTaskId: number,
  lagDays = 0,
): Promise<TaskDependency> {
  const { data } = await api.post<TaskDependency>(
    `/projects/${projectId}/task-dependencies`,
    { task_id: taskId, depends_on_task_id: dependsOnTaskId, lag_days: lagDays },
  )
  return data
}

export async function updateTask(
  taskId: number,
  update: {
    name?: string
    description?: string
    level_tag?: string
    trade_tag?: string
    apartment_tag?: string
    room_tag?: string
    start_date?: string
    duration_days?: number
    notes?: string
  },
): Promise<Task> {
  const { data } = await api.put<Task>(`/tasks/${taskId}`, update)
  return data
}

// Confirm extracted tasks — clears existing tasks and inserts these, along with inferred deps
export async function confirmSchedule(
  projectId: number,
  tasks: ExtractedTask[],
  dependencies: InferredDependency[],
): Promise<{ tasks_created: number; deps_created: number }> {
  const { data } = await api.post<{ tasks_created: number; deps_created: number }>(
    `/projects/${projectId}/confirm-schedule`,
    { tasks, dependencies },
  )
  return data
}
