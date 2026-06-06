import api from './client'

export interface AuthUser {
  id: number
  email: string
  name: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
}

export async function registerUser(email: string, password: string, name: string): Promise<AuthUser> {
  const res = await api.post<AuthUser>('/auth/register', { email, password, name })
  return res.data
}

export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  // Backend uses OAuth2PasswordRequestForm — must send as form data, NOT JSON
  const params = new URLSearchParams()
  params.append('username', email)
  params.append('password', password)
  const res = await api.post<LoginResponse>('/auth/login', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return res.data
}

export async function getMe(): Promise<AuthUser> {
  const res = await api.get<AuthUser>('/auth/me')
  return res.data
}
