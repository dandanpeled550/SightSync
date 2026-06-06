import api from './client'

export interface InventoryItem {
  id: number
  project_id: number
  name: string
  unit: string
  current_stock: number
  min_stock_alert: number | null
}

export interface InventoryItemCreate {
  name: string
  unit?: string
  current_stock?: number
  min_stock_alert?: number | null
}

export interface InventoryItemUpdate {
  name?: string
  unit?: string
  current_stock?: number
  min_stock_alert?: number | null
}

export async function fetchInventory(projectId: number): Promise<InventoryItem[]> {
  const res = await api.get<InventoryItem[]>(`/projects/${projectId}/inventory`)
  return res.data
}

export async function createInventoryItem(projectId: number, data: InventoryItemCreate): Promise<InventoryItem> {
  const res = await api.post<InventoryItem>(`/projects/${projectId}/inventory`, data)
  return res.data
}

export async function updateInventoryItem(itemId: number, data: InventoryItemUpdate): Promise<InventoryItem> {
  const res = await api.put<InventoryItem>(`/inventory/${itemId}`, data)
  return res.data
}

export async function deleteInventoryItem(itemId: number): Promise<void> {
  await api.delete(`/inventory/${itemId}`)
}
