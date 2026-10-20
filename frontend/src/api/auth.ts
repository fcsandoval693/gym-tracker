import { request } from './request'

export type User = { id: number; email: string; first_name: string }
type AuthResponse = { token: string; user: User }

export const register = (email: string, password: string, firstName: string) => request<AuthResponse>('/auth/register/', 'POST', { email, password, first_name: firstName })
export const login = (email: string, password: string) => request<AuthResponse>('/auth/login/', 'POST', { email, password })
export const logout = () => request<void>('/auth/logout/', 'POST')
export const getMe = () => request<User>('/auth/me/')
export const updateMe = (firstName: string) => request<User>('/auth/me/', 'PATCH', { first_name: firstName })
// Devuelve un token nuevo: el anterior deja de valer al cambiar la contraseña.
export const changePassword = (currentPassword: string, newPassword: string) => request<AuthResponse>('/auth/change-password/', 'POST', { current_password: currentPassword, new_password: newPassword })
