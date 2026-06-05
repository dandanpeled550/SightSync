import api from './client'

export interface Material {
  id: number
  daily_log_id: number
  material_name: string
  quantity: number
  unit: string
  notes: string | null
}

export interface MaterialCreate {
  material_name: string
  quantity: number
  unit: string
  notes?: string
}

export async function fetchMaterials(logId: number): Promise<Material[]> {
  const res = await api.get<Material[]>(`/daily-logs/${logId}/materials`)
  return res.data
}

export async function createMaterial(logId: number, data: MaterialCreate): Promise<Material> {
  const res = await api.post<Material>(`/daily-logs/${logId}/materials`, data)
  return res.data
}

export async function deleteMaterial(logId: number, materialId: number): Promise<void> {
  await api.delete(`/daily-logs/${logId}/materials/${materialId}`)
}
