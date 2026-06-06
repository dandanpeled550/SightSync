import api from './client'

export async function uploadPhoto(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  // Do NOT set Content-Type manually — Axios sets multipart boundary automatically
  const res = await api.post<{ url: string }>('/uploads/photo', form)
  return res.data.url
}

export interface SitePhoto {
  id: number
  project_id: number
  daily_log_id: number | null
  photo_url: string
  caption: string | null
  created_at: string
}

export interface SitePhotoCreate {
  photo_url: string
  caption?: string
  daily_log_id?: number
}

export async function fetchSitePhotos(projectId: number): Promise<SitePhoto[]> {
  const res = await api.get<SitePhoto[]>(`/projects/${projectId}/photos`)
  return res.data
}

export async function createSitePhoto(projectId: number, data: SitePhotoCreate): Promise<SitePhoto> {
  const res = await api.post<SitePhoto>(`/projects/${projectId}/photos`, data)
  return res.data
}

export async function deleteSitePhoto(projectId: number, photoId: number): Promise<void> {
  await api.delete(`/projects/${projectId}/photos/${photoId}`)
}
